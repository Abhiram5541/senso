import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck } from "lucide-react";
import { MarketingChrome } from "@/components/shell/marketing-chrome";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Creators claim their own SENSO profile and read their authorised analytics. Brands and agencies open a workspace to search the index.",
};

/* ---------------------------------------------------------------------------
 * The front door.
 *
 * `/register` stays what it has always been: an enquiry for a client whose
 * plan is negotiated, reviewed by a person (D41). This page is the other
 * door, and it opens immediately.
 *
 * Both kinds of account arrive through Google. For a creator that is the
 * point — identity has to be worth something before an account can read a
 * creator's authorised analytics — and for a brand it simply removes a
 * password from a product that would rather not store one.
 * ------------------------------------------------------------------------ */

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Nothing was created.",
  state_invalid: "That sign-in link expired. Start again.",
  no_email: "That Google account has no email address on it.",
  email_unverified: "Verify your email with Google first, then come back.",
  exchange_failed: "Google did not complete the sign-in. Try again.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  unconfigured: "Google sign-in is not configured on this deployment.",
  failed: "Something went wrong signing in. Try again.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.failed) : null;

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-8 lg:pt-20">
        <h1 className="display-sm text-ink">Create your account</h1>
        <p className="mt-5 max-w-xl text-md leading-7 text-ink-muted">
          Two kinds of account, one sign-in. Both open straight away — no password to
          choose, and nothing to wait for.
        </p>

        {message && (
          <p
            role="alert"
            className="mt-8 rounded-xl border border-critical-line bg-critical-soft px-4 py-3 text-base text-critical"
          >
            {message}
          </p>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <AccountCard
            intent="creator"
            icon={<BarChart3 className="size-5" aria-hidden />}
            title="I'm a creator"
            body="Claim the profile SENSO already holds on you, or add yourself if we have not indexed you yet. Read your own analytics, see how you are scored, and correct anything we got wrong."
            cta="Continue with Google"
            note="You will connect YouTube next. That connection is what proves the channel is yours."
          />
          <AccountCard
            intent="brand"
            icon={<ShieldCheck className="size-5" aria-hidden />}
            title="I'm a brand or agency"
            body="Open a workspace and search the index on audience quality rather than follower count. Five searches a month on the free plan, with saved profiles and shortlists kept either way."
            cta="Continue with Google"
            note="A workspace is created in your name. You can rename it and invite your team afterwards."
          />
        </div>

        <p className="mt-10 text-base text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
          .
        </p>
        <p className="mt-3 text-sm text-ink-subtle">
          Negotiating a plan or need an invoice?{" "}
          <Link href="/register" className="underline underline-offset-4 hover:text-ink">
            Request an account
          </Link>{" "}
          and a person will reply.
        </p>
      </div>
    </MarketingChrome>
  );
}

function AccountCard({
  intent,
  icon,
  title,
  body,
  cta,
  note,
}: {
  intent: "creator" | "brand";
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  note: string;
}) {
  return (
    <section className="flex flex-col rounded-[1.25rem] border border-line bg-surface p-6">
      <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-ink">
        {icon}
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-3 flex-1 text-base leading-6 text-ink-muted">{body}</p>
      {/* A link, not a fetch: the browser has to land on Google's own origin
          for the consent to mean anything. */}
      <a
        href={`/api/internal/auth/google/start?intent=${intent}`}
        className="press mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-md font-semibold text-ink hover:bg-brand-active"
      >
        {cta}
        <ArrowRight className="size-4" aria-hidden />
      </a>
      <p className="mt-3 text-sm leading-5 text-ink-subtle">{note}</p>
    </section>
  );
}
