import { formatCompact } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import type { InstagramCreatorAnalytics } from "@/server/services/creator-analytics-service";

/* ---------------------------------------------------------------------------
 * The creator's own Instagram insights, under the same rule as the YouTube
 * block beside it: read with their grant, shown to them, and to nobody else.
 *
 * Nothing here is stored, so there is no "as of" stamp beyond the window the
 * API reported. A metric Instagram did not return prints as absent rather
 * than as zero — `follower_count` is refused outright under 100 followers,
 * and rendering that refusal as "0 followers gained" would be inventing a
 * reading out of a permission error.
 * ------------------------------------------------------------------------ */

export function InstagramAnalytics({ result }: { result: InstagramCreatorAnalytics }) {
  if (result.state === "not_connected") {
    return (
      <Notice tone="info" title="Connect Instagram to see your own insights">
        Reach, views and engagement for your professional account come from Instagram with
        your authorisation. SENSO cannot read them from public data.
      </Notice>
    );
  }

  if (result.state === "needs_reauth") {
    return (
      <Notice tone="caution" title="Your Instagram connection needs renewing">
        Reconnect on the Connections page and these figures come back. Nothing else on your
        profile is affected.
      </Notice>
    );
  }

  if (result.state === "unavailable") {
    return (
      <Notice tone="caution" title="Instagram did not answer">
        {result.reason} Your public figures above are unaffected.
      </Notice>
    );
  }

  const { data } = result;
  const reached = data.days.filter((day) => day.reach !== null);
  const peak = reached.reduce((best, day) => Math.max(best, day.reach ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Instagram insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base text-ink-muted">
          Read from your authorised Instagram account for {data.from} to {data.to}. Only you
          can see this — it never appears on your public profile, in client search, or in
          an export.
        </p>

        <dl className="grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-4">
          {[
            ["Views", data.totals.views],
            ["Likes", data.totals.likes],
            ["Comments", data.totals.comments],
            ["Saves", data.totals.saves],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-surface px-4 py-3">
              <dt className="text-sm text-ink-subtle">{label}</dt>
              <dd className="font-num text-stat font-semibold text-ink">
                {formatCompact(value as number | null)}
              </dd>
            </div>
          ))}
        </dl>

        {reached.length === 0 ? (
          <p className="text-base text-ink-muted">
            Instagram returned no daily reach for this window. Insights cover the last 30
            days and start once the account has activity to report — it does not mean
            nobody saw your posts.
          </p>
        ) : (
          <div>
            <p className="label-caps text-ink-subtle">Daily reach</p>
            <ol className="mt-2 flex h-24 items-end gap-px" aria-hidden>
              {reached.map((day) => (
                <li
                  key={day.date}
                  className="min-w-0 flex-1 rounded-t-sm bg-brand/70"
                  style={{ height: `${peak > 0 ? Math.max(2, ((day.reach ?? 0) / peak) * 100) : 2}%` }}
                />
              ))}
            </ol>
            <p className="mt-2 text-sm text-ink-subtle">
              {reached.length} days · peak {formatCompact(peak)} accounts reached
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
