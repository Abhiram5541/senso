import { formatCompact } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import type { CreatorAnalytics } from "@/server/services/creator-analytics-service";

/* ---------------------------------------------------------------------------
 * The creator's own YouTube Analytics, and the only surface allowed to show
 * them.
 *
 * These figures are Authorized Data: read with the creator's grant, visible
 * to that creator, and to nobody else. They are rendered apart from the rest
 * of the page, and labelled as the creator's own, so that the boundary is
 * legible rather than merely enforced — somebody adding a feature here should
 * be able to see that this block is different from the ones around it.
 *
 * Nothing here is stored. The page reads it live each time, which is why
 * there is no "as of" stamp beyond the window the API reported.
 * ------------------------------------------------------------------------ */

export function AuthorizedAnalytics({ result }: { result: CreatorAnalytics }) {
  if (result.state === "not_connected") {
    return (
      <Notice tone="info" title="Connect YouTube to see your own analytics">
        Views, watch time and subscriber movement come from YouTube Analytics and need your
        authorisation. SENSO cannot read them from the public API.
      </Notice>
    );
  }

  if (result.state === "needs_reauth") {
    return (
      <Notice tone="caution" title="Your YouTube connection needs renewing">
        Reconnect on the Connections page and these figures come back. Nothing else on your
        profile is affected.
      </Notice>
    );
  }

  if (result.state === "unavailable") {
    return (
      <Notice tone="caution" title="YouTube Analytics did not answer">
        {result.reason} Your public figures above are unaffected.
      </Notice>
    );
  }

  const { data } = result;
  const net = data.totals.subscribersGained - data.totals.subscribersLost;
  const peak = data.days.reduce((best, day) => (day.views > best ? day.views : best), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your YouTube Analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base text-ink-muted">
          Read from your authorised YouTube account for {data.from} to {data.to}. Only you
          can see this — it never appears on your public profile, in client search, or in
          an export.
        </p>

        <dl className="grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-4">
          {[
            ["Views", formatCompact(data.totals.views)],
            ["Minutes watched", formatCompact(data.totals.minutesWatched)],
            ["Subscribers gained", formatCompact(data.totals.subscribersGained)],
            ["Net subscribers", `${net >= 0 ? "+" : ""}${formatCompact(net)}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3">
              <dt className="text-sm text-ink-subtle">{label}</dt>
              <dd className="font-num text-stat font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {data.days.length === 0 ? (
          <p className="text-base text-ink-muted">
            YouTube returned no days for this window. That usually means the channel is new,
            not that traffic was zero.
          </p>
        ) : (
          <div>
            <p className="label-caps text-ink-subtle">Daily views</p>
            {/* Hand-rolled, like every other chart outside the dashboard: a
                charting library on a page that draws one bar row is a
                dependency bought for nothing. */}
            <ol className="mt-2 flex h-24 items-end gap-px" aria-hidden>
              {data.days.map((day) => (
                <li
                  key={day.date}
                  className="min-w-0 flex-1 rounded-t-sm bg-brand/70"
                  style={{ height: `${peak > 0 ? Math.max(2, (day.views / peak) * 100) : 2}%` }}
                />
              ))}
            </ol>
            <p className="mt-2 text-sm text-ink-subtle">
              {data.days.length} days · peak {formatCompact(peak)} views
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
