import { createHmac } from "node:crypto";
import { shared } from "@/server/data/process-store";

/* ---------------------------------------------------------------------------
 * Outbound delivery — Slack, Microsoft Teams, email, signed webhooks.
 *
 * One service because the four share a shape: read a credential from the
 * environment, post one HTTP request, report honestly whether it was sent.
 * Nothing here retries or queues; a notification that matters enough to
 * guarantee belongs in a real queue (deferred with Redis, CLAUDE.md §3), and
 * pretending a fire-and-forget POST is guaranteed would be the integrations
 * page's cardinal sin restated in code.
 *
 * Every sender returns `false` rather than throwing when unconfigured or
 * failed: callers are producers like the nightly cron, and a missing webhook
 * must never fail the job that tried to announce itself.
 * ------------------------------------------------------------------------ */

const configured = (key: string): string | null => {
  const value = process.env[key]?.trim();
  return value ? value : null;
};

export interface NotifyChannels {
  slack: boolean;
  teams: boolean;
  email: boolean;
  /** Webhook signing — always available once the secret is set. */
  webhook: boolean;
}

/* --- Mail transport ------------------------------------------------------
 * Two ways out: an SMTP server, or Resend's HTTP API. SMTP wins when it is
 * configured, because an operator who set a host meant to use it.
 *
 * They are not equivalent, and the difference is not cosmetic. Resend calls
 * back with delivered / opened / bounced, which is what advances an outreach
 * message past "sent" (see outreach-service). SMTP hands the message to a
 * server and learns nothing afterwards — there is no callback in the
 * protocol. So on SMTP an outreach message is truthfully "sent" forever, and
 * the UI has to say so rather than leaving a reader to assume the silence
 * means undelivered.
 * ---------------------------------------------------------------------- */

export type MailTransport = "smtp" | "resend" | "none";

export function mailTransport(): MailTransport {
  if (!configured("EMAIL_FROM")) return "none";
  if (configured("SMTP_HOST") && configured("SMTP_USER") && configured("SMTP_PASSWORD")) {
    return "smtp";
  }
  return configured("RESEND_API_KEY") ? "resend" : "none";
}

/**
 * Whether the active transport reports what happened to a message after it
 * left. Only Resend does; SMTP has no callback, so delivery, open and bounce
 * tracking is unavailable and the outreach screen says as much.
 */
export function mailTracksDelivery(): boolean {
  return mailTransport() === "resend";
}

export function notifyChannels(): NotifyChannels {
  return {
    slack: Boolean(configured("SLACK_WEBHOOK_URL")),
    teams: Boolean(configured("TEAMS_WEBHOOK_URL")),
    email: mailTransport() !== "none",
    webhook: Boolean(configured("WEBHOOK_SIGNING_SECRET")),
  };
}

async function post(url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendSlack(text: string): Promise<boolean> {
  const url = configured("SLACK_WEBHOOK_URL");
  if (!url) return false;
  return post(url, { text });
}

/**
 * Teams "Workflows" webhooks expect an Adaptive Card envelope; the legacy
 * connector accepted bare text. The card form works on both current setups.
 */
export async function sendTeams(text: string): Promise<boolean> {
  const url = configured("TEAMS_WEBHOOK_URL");
  if (!url) return false;
  return post(url, {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [{ type: "TextBlock", text, wrap: true }],
        },
      },
    ],
  });
}

/**
 * One connection pool for the life of the process, anchored on the process
 * store so a hot reload does not leave the old one holding sockets. Built
 * lazily: a deployment with no SMTP configured never loads nodemailer.
 */
async function smtpTransport() {
  const state = shared("smtp", () => ({ transport: null as unknown, signature: "" }));
  const host = configured("SMTP_HOST")!;
  const port = Number(configured("SMTP_PORT") ?? 587);
  const user = configured("SMTP_USER")!;
  const pass = configured("SMTP_PASSWORD")!;
  // Rebuilt when the credentials change, so a reload with new settings is
  // not served by a pool authenticated as the old user.
  const signature = `${host}:${port}:${user}`;

  if (state.transport && state.signature === signature) return state.transport;

  const nodemailer = await import("nodemailer");
  state.transport = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS. Everything else starts in the clear and upgrades
    // with STARTTLS, which `secure: false` means here — not "no encryption".
    secure: configured("SMTP_SECURE") === "true" || port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
  });
  state.signature = signature;
  return state.transport;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const from = configured("EMAIL_FROM");
  if (!from) return false;

  const transport = mailTransport();
  if (transport === "none") return false;

  if (transport === "smtp") {
    try {
      const mailer = (await smtpTransport()) as {
        sendMail: (message: Record<string, unknown>) => Promise<unknown>;
      };
      await mailer.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      return true;
    } catch (error) {
      // A refused credential and an unreachable host look the same to a
      // caller, and both mean the mail did not go. The reason is logged so
      // an operator can tell them apart.
      console.error(`[mail] SMTP send failed: ${String(error)}`);
      return false;
    }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configured("RESEND_API_KEY")!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [options.to], subject: options.subject, html: options.html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Opens a connection and authenticates without sending anything, so an
 * operator can tell a wrong password from a wrong port before a client's
 * invite silently fails to arrive.
 */
export async function verifyMailTransport(): Promise<{
  transport: MailTransport;
  ok: boolean;
  detail: string;
  tracksDelivery: boolean;
}> {
  const transport = mailTransport();
  const tracksDelivery = mailTracksDelivery();

  if (transport === "none") {
    return {
      transport,
      ok: false,
      tracksDelivery,
      detail: configured("EMAIL_FROM")
        ? "EMAIL_FROM is set but no transport is: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD, or RESEND_API_KEY."
        : "EMAIL_FROM is not set, so nothing can be sent.",
    };
  }

  if (transport === "resend") {
    return {
      transport,
      ok: true,
      tracksDelivery,
      detail: `Sending through Resend as ${configured("EMAIL_FROM")}. Delivery, open and bounce tracking is available.`,
    };
  }

  try {
    const mailer = (await smtpTransport()) as { verify: () => Promise<boolean> };
    await mailer.verify();
    return {
      transport,
      ok: true,
      tracksDelivery,
      detail: `Authenticated against ${configured("SMTP_HOST")}:${configured("SMTP_PORT") ?? 587} as ${configured("SMTP_USER")}. SMTP reports nothing after a message is handed over, so delivery, open and bounce tracking is unavailable.`,
    };
  } catch (error) {
    return { transport, ok: false, tracksDelivery, detail: String(error) };
  }
}

/**
 * HMAC-SHA256 over the exact bytes being sent, so a receiver can verify the
 * payload came from SENSO and was not altered. The signature goes in
 * `X-SENSO-Signature` as `sha256=<hex>` — the shape GitHub and Stripe
 * receivers already know how to check.
 */
export function signPayload(body: string): string | null {
  const secret = configured("WEBHOOK_SIGNING_SECRET");
  if (!secret) return null;
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export async function deliverWebhook(url: string, event: unknown): Promise<boolean> {
  const body = JSON.stringify(event);
  const signature = signPayload(body);
  if (!signature) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SENSO-Signature": signature,
      },
      body,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * An operations event, fanned out to every configured channel at once.
 *
 * The producers are jobs — the nightly snapshot, a finished harvest — and a
 * job does not care which chat tool the team reads, so it says it once here.
 * Returns which channels actually accepted it.
 */
export async function sendOpsEvent(
  title: string,
  lines: string[],
): Promise<{ slack: boolean; teams: boolean; email: boolean }> {
  const text = [`*${title}*`, ...lines].join("\n");
  const reportTo = configured("EMAIL_REPORT_TO");

  const [slack, teams, email] = await Promise.all([
    sendSlack(text),
    sendTeams([title, ...lines].join("\n\n")),
    reportTo
      ? sendEmail({
          to: reportTo,
          subject: title,
          html: `<h3>${title}</h3>${lines.map((line) => `<p>${line}</p>`).join("")}`,
        })
      : Promise.resolve(false),
  ]);

  return { slack, teams, email };
}
