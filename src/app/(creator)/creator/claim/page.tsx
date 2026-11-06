import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert, PlayCircle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { requirePageSession } from "@/server/auth/rbac";
import { connectionConfigured } from "@/server/services/connection-service";

export const metadata: Metadata = { title: "Claim your channel" };

/* ---------------------------------------------------------------------------
 * The step between signing up and having a portal worth looking at.
 *
 * Every other page under `/creator` resolves through `requireOwnProfile`,
 * which 404s when the session carries no `influencerId` — correct for those
 * pages and a dead end for somebody who signed up thirty seconds ago. This
 * one is reachable in exactly that state and is the only page that is.
 *
 * It asks for one thing, and the thing it asks for is the proof: consenting
 * with the Google account that owns the channel is what links the record.
 * There is no field to type a channel name into, because a typed name proves
 * nothing and the whole point of the portal is that the person reading a
 * creator's authorised analytics is that creator.
 * ------------------------------------------------------------------------ */

const OUTCOMES: Record<string, { tone: "bad" | "good"; text: string }> = {
  cancelled: { tone: "bad", text: "Sign-in was cancelled. Nothing was linked." },
  state_invalid: { tone: "bad", text: "That link expired. Start again." },
  no_channel: {
    tone: "bad",
    text: "That Google account does not own a YouTube channel. Use the account that manages your channel.",
  },
  already_claimed: {
    tone: "bad",
    text: "This channel has already been claimed on SENSO. Contact support if that is not you.",
  },
  ingest_failed: { tone: "bad", text: "We could not read that channel from YouTube just now." },
  unconfigured: { tone: "bad", text: "YouTube connections are not configured on this deployment." },
  failed: { tone: "bad", text: "Something went wrong. Try again." },
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; detail?: string }>;
}) {
  const user = await requirePageSession("/creator/claim");
  // Already linked: this page has nothing left to do for them.
  if (user.influencerId) redirect("/creator");

  const { connection, detail } = await searchParams;
  const outcome = connection ? (OUTCOMES[connection] ?? OUTCOMES.failed) : null;
  const configured = connectionConfigured();

  return (
    <>
      <PageHeader
        title="Claim your channel"
        description="Connect the Google account that owns your YouTube channel. That connection is what proves the channel is yours — and it is the only thing that can."
      />

      <PageBody>
      {outcome && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-xl border border-critical-line bg-critical-soft px-4 py-3 text-base text-critical"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {outcome.text}
            {detail && connection === "ingest_failed" && (
              <span className="mt-1 block text-sm opacity-80">{detail}</span>
            )}
          </span>
        </p>
      )}

      <section className="mt-8 max-w-2xl rounded-[1.25rem] border border-line bg-surface p-7">
        <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-ink">
          <PlayCircle className="size-5" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold text-ink">Connect YouTube</h2>
        <p className="mt-3 text-base leading-6 text-ink-muted">
          We will read which channel the account owns, and nothing else. If SENSO already
          holds a profile for it, it becomes yours. If we have never indexed you, we will
          add your channel from your own authorised account — which is better evidence than
          anything we could collect about you from outside.
        </p>

        {configured ? (
          <a
            href="/api/internal/claim/youtube/start"
            className="press mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-5 text-md font-semibold text-ink hover:bg-brand-active"
          >
            Connect YouTube
            <ArrowRight className="size-4" aria-hidden />
          </a>
        ) : (
          <p className="mt-6 rounded-xl bg-sunken px-4 py-3 text-base text-ink-muted">
            YouTube connections are not configured on this deployment, so there is nothing
            to connect to yet.
          </p>
        )}
      </section>

      <section className="mt-6 max-w-2xl rounded-[1.25rem] border border-line bg-sunken p-6">
        <h2 className="font-display text-md font-semibold text-ink">Instagram</h2>
        <p className="mt-2 text-base leading-6 text-ink-muted">
          Instagram cannot be claimed yet. SENSO reads Instagram through its own Business
          Discovery access, which can look a public professional account up but cannot ask
          you to authorise anything — so there is no way for you to prove an Instagram
          handle is yours. Letting you type one in would create a claim we could not
          check, and an unverifiable claim about who someone is is worth less than nothing
          on this product. It needs Facebook Login for Business, and that is coming.
        </p>
      </section>
      </PageBody>
    </>
  );
}
