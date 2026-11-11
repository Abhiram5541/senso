import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/shell/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      summary="What SENSO collects, where it comes from, how long it is kept, and how a creator can correct or remove it."
      updated="11 November 2026"
      sections={[
        {
          heading: "What is collected, and from where",
          body: (
            <>
              <p>
                Creator records are built from four kinds of source, in this order of
                authority: official platform APIs; accounts a creator has connected through
                OAuth; approved data providers; and permitted public web content. Every stored
                fact keeps its source, the time it was collected, and a confidence value.
              </p>
              <p>
                SENSO does not scrape private or platform-protected information, and does
                not use AI providers as a route to data a platform has not made available.
              </p>
            </>
          ),
        },
        {
          heading: "Connected accounts",
          body: (
            <>
              <p>
                When a creator connects an account, SENSO requests the narrowest scopes
                that allow it to read that creator&apos;s own statistics. Access tokens are
                encrypted at rest and are never sent to a browser.
              </p>
              <p>
                Audience demographics come only from connected professional accounts. They are
                visible to the creator and to SENSO reviewers — never to clients browsing
                a public profile, and never through the API.
              </p>
            </>
          ),
        },
        {
          heading: "YouTube API Services",
          body: (
            <>
              <p>
                SENSO uses YouTube API Services. By using SENSO you agree to be bound by the{" "}
                <a
                  href="https://www.youtube.com/t/terms"
                  className="rounded font-medium text-brand-ink underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  YouTube Terms of Service
                </a>
                , and Google&apos;s handling of any data it receives is governed by the{" "}
                <a
                  href="https://policies.google.com/privacy"
                  className="rounded font-medium text-brand-ink underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Privacy Policy
                </a>
                .
              </p>
              <p>
                From the YouTube Data API, SENSO stores a channel&apos;s public profile and
                statistics, and for its recent uploads the video id, title, caption, publish
                time, hashtags, thumbnail URL and public counts. A creator who connects their
                own channel also grants read access to that channel&apos;s YouTube Analytics.
                Those authorized figures are shown to the creator who authorized them and to no
                one else: never to a brand, never in search, never in an export, and never
                through the SENSO API.
              </p>
              <p>
                A creator may revoke SENSO&apos;s access to their YouTube account at any time,
                either by disconnecting it inside their SENSO creator portal or through{" "}
                <a
                  href="https://security.google.com/settings/security/permissions"
                  className="rounded font-medium text-brand-ink underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google&apos;s security settings page
                </a>
                . Revoking stops authorized analytics refreshing immediately, and the stored
                tokens are discarded.
              </p>
            </>
          ),
        },
        {
          heading: "Correction and removal",
          body: (
            <>
              <p>
                A creator can raise a correction request from their portal. A reviewer checks
                the underlying source rather than editing the number directly, because editing
                a value without correcting its source breaks the record&apos;s traceability.
              </p>
              <p>
                Creators may request removal of their profile. Disconnecting an account stops
                authorized analytics refreshing immediately.{" "}
                <Link href="/help/verification" className="rounded font-medium text-brand-ink underline underline-offset-2">
                  How verification works
                </Link>
              </p>
            </>
          ),
        },
        {
          heading: "Data deletion",
          body: (
            <>
              <p>
                Removing SENSO from a connected Instagram or YouTube account revokes the grant
                on both sides: the platform tells SENSO, and the stored token and the
                connection are deleted immediately. The creator&apos;s public profile is not
                deleted with them, because it was never read from the grant — it comes from
                the platforms&apos; public APIs, the same way an unconnected creator&apos;s
                does.
              </p>
              <p>
                To have the public profile removed as well, write to{" "}
                <a href="mailto:privacy@senso360.com" className="rounded font-medium text-brand-ink underline underline-offset-2">
                  privacy@senso360.com
                </a>{" "}
                with the account handle. A deletion request raised through Meta returns a
                confirmation code; quote it in that email and it will be matched to the
                request.
              </p>
            </>
          ),
        },
        {
          heading: "Retention",
          body: (
            <>
              <p>
                Historical snapshots are retained because the product&apos;s value depends on
                them — growth, consistency and anomaly detection are all comparisons against a
                creator&apos;s own past. Raw research artifacts and comment text are retained only
                as long as needed to produce the derived signals, then discarded.
              </p>
              <p>
                Stored YouTube metadata is kept inside the age its platform allows. Public
                statistics — views, likes and comment counts — and the scores SENSO derives
                from them are retained for up to 36 calendar months. Everything else read from
                the API, including video titles, captions and creator names, is re-read from
                YouTube on a rolling cycle: a stored copy that reaches 30 days old is refreshed
                from the API, or removed if the API no longer returns it, which is how SENSO
                learns that a video has been deleted or made private by its owner.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
