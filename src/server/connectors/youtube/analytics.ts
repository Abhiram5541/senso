import { ConnectorUnavailable } from "@/server/connectors/youtube";

/* ---------------------------------------------------------------------------
 * YouTube Analytics, read with the creator's own grant.
 *
 * This is the only place `yt-analytics.readonly` is spent, and it exists
 * because the scope was being requested without it. Asking for a permission
 * nothing uses is a policy breach in its own right — "only request access to
 * authorization scopes that they currently use" — and it is one of the
 * reasons an OAuth verification submission is rejected, because a reviewer
 * has to watch each requested scope being exercised in the demo video.
 *
 * Everything here is Authorized Data, which carries an access rule the rest
 * of the product's figures do not: "API Clients must not display or allow
 * access to Authorized Data to anyone other than the authorizing user or
 * agents expressly approved by that user." So nothing this module returns
 * may reach a brand-facing surface. It is read on creator-portal pages, for
 * the creator who granted it, and nowhere else — see the guard in
 * `creatorAnalytics`.
 * ------------------------------------------------------------------------ */

const ENDPOINT = "https://youtubeanalytics.googleapis.com/v2/reports";

export interface AnalyticsDay {
  date: string;
  views: number;
  minutesWatched: number;
  averageViewDurationSeconds: number;
  subscribersGained: number;
  subscribersLost: number;
}

export interface ChannelAnalytics {
  /** Inclusive, ISO yyyy-mm-dd. */
  from: string;
  to: string;
  days: AnalyticsDay[];
  totals: {
    views: number;
    minutesWatched: number;
    subscribersGained: number;
    subscribersLost: number;
  };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Reads the authorising channel's own daily figures.
 *
 * `ids=channel==MINE` resolves to whichever channel the token belongs to, so
 * no channel id is passed in and none can be substituted: a creator cannot
 * ask for somebody else's analytics by editing a parameter, because the
 * parameter does not exist.
 */
export async function fetchChannelAnalytics(
  accessToken: string,
  days = 28,
): Promise<ChannelAnalytics> {
  // YouTube Analytics lags roughly two days; asking for today returns rows of
  // zeroes that would read as a collapse in traffic rather than as absent data.
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);

  const url = new URL(ENDPOINT);
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", isoDay(start));
  url.searchParams.set("endDate", isoDay(end));
  url.searchParams.set(
    "metrics",
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
  );
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("sort", "day");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    // 403 here usually means the grant predates the analytics scope rather
    // than that anything is broken, so it is reported as a reauth rather than
    // as an outage.
    throw new ConnectorUnavailable(
      "youtube",
      response.status === 401 || response.status === 403 ? "forbidden" : "upstream_error",
      `YouTube Analytics refused the request (HTTP ${response.status}).`,
    );
  }

  const body = (await response.json()) as { rows?: (string | number)[][] };
  const rows = body.rows ?? [];

  const parsed: AnalyticsDay[] = rows.map((row) => ({
    date: String(row[0]),
    views: Number(row[1]) || 0,
    minutesWatched: Number(row[2]) || 0,
    averageViewDurationSeconds: Number(row[3]) || 0,
    subscribersGained: Number(row[4]) || 0,
    subscribersLost: Number(row[5]) || 0,
  }));

  return {
    from: isoDay(start),
    to: isoDay(end),
    days: parsed,
    totals: {
      views: parsed.reduce((sum, day) => sum + day.views, 0),
      minutesWatched: parsed.reduce((sum, day) => sum + day.minutesWatched, 0),
      subscribersGained: parsed.reduce((sum, day) => sum + day.subscribersGained, 0),
      subscribersLost: parsed.reduce((sum, day) => sum + day.subscribersLost, 0),
    },
  };
}
