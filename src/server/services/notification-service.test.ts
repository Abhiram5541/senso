import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { notifyChannels, signPayload } from "./notification-service";

/*
 * Only the parts a mistake in would be invisible: the signature a receiver
 * verifies against, and the configured-channel report the catalog grades from.
 * The senders themselves are one fetch each — exercised for real by the
 * nightly cron, not faked here.
 */

const KEY = "WEBHOOK_SIGNING_SECRET";
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("signPayload", () => {
  it("produces a receiver-verifiable sha256 HMAC over the exact bytes", () => {
    process.env[KEY] = "test-secret";
    const body = JSON.stringify({ event: "shortlist.updated", id: "sl_1" });

    const signature = signPayload(body);

    const expected = `sha256=${createHmac("sha256", "test-secret").update(body, "utf8").digest("hex")}`;
    expect(signature).toBe(expected);
  });

  it("refuses to sign with no secret rather than signing with an empty one", () => {
    delete process.env[KEY];
    expect(signPayload("{}")).toBeNull();
  });

  it("treats a whitespace-only secret as unset", () => {
    process.env[KEY] = "   ";
    expect(signPayload("{}")).toBeNull();
    expect(notifyChannels().webhook).toBe(false);
  });
});

describe("mail transport selection", () => {
  const clear = () => {
    for (const key of ["EMAIL_FROM", "RESEND_API_KEY", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]) {
      delete process.env[key];
    }
  };

  it("is none without a sender, whatever else is configured", async () => {
    const { mailTransport } = await import("./notification-service");
    clear();
    process.env.RESEND_API_KEY = "re_x";
    process.env.SMTP_HOST = "smtp.example.com";
    expect(mailTransport()).toBe("none");
    clear();
  });

  it("prefers SMTP when its three variables are set — an operator who set a host meant it", async () => {
    const { mailTransport, mailTracksDelivery } = await import("./notification-service");
    clear();
    process.env.EMAIL_FROM = "SENSO <noreply@senso360.com>";
    process.env.RESEND_API_KEY = "re_x";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASSWORD = "pass";
    expect(mailTransport()).toBe("smtp");
    // The point of the flag: SMTP has no callback, so tracking is off.
    expect(mailTracksDelivery()).toBe(false);
    clear();
  });

  it("falls back to Resend when SMTP is only half configured", async () => {
    const { mailTransport, mailTracksDelivery } = await import("./notification-service");
    clear();
    process.env.EMAIL_FROM = "SENSO <noreply@senso360.com>";
    process.env.RESEND_API_KEY = "re_x";
    process.env.SMTP_HOST = "smtp.example.com"; // no user, no password
    expect(mailTransport()).toBe("resend");
    expect(mailTracksDelivery()).toBe(true);
    clear();
  });
});
