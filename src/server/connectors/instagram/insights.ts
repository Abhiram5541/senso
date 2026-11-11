import { z } from "zod";
import { ConnectorUnavailable } from "./instagram-connector";

/* ---------------------------------------------------------------------------
 * Instagram insights, read with the creator's own grant.
 *
 * This is the only place `instagram_business_manage_insights` is spent, and it
 * exists for the same reason the YouTube Analytics module beside it does:
 * requesting a permission nothing uses is a policy breach on its own, and it
 * is what a reviewer rejects, because they have to watch each requested
 * permission being exercised.
 *
 * Everything here is Authorized Data. It is read for the creator who granted
 * it, shown to that creator, and never stored — the guard that keeps it off
 * every brand-facing surface lives in `instagramCreatorAnalytics`.
 *
 * Two shapes come back from the same endpoint and are parsed separately: a
 * metric asked for with `period=day` returns a `values` array, one entry per
 * day, while one asked for with `metric_type=total_value` returns a single
 * figure for the window. Mixing them in one request is what the API refuses.
 * ------------------------------------------------------------------------ */

const GRAPH = "https://graph.instagram.com";

/** Instagram serves insights for the last 30 days only. */
const MAX_WINDOW_DAYS = 30;

export interface InstagramInsightDay {
  /** ISO yyyy-mm-dd. */
  date: string;
  reach: number | null;
  followerCount: number | null;
}

export interface InstagramInsights {
  from: string;
  to: string;
  days: InstagramInsightDay[];
  totals: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
  };
}

const Series = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.object({ value: z.number(), end_time: z.string() })).optional(),
    }),
  ),
});

const Totals = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      total_value: z.object({ value: z.number().optional() }).optional(),
    }),
  ),
});

const GraphError = z.object({ error: z.object({ message: z.string(), code: z.number().optional() }) });

function describe(payload: unknown, status: number): string {
  const parsed = GraphError.safeParse(payload);
  if (!parsed.success) return `HTTP ${status}`;
  const { message, code } = parsed.data.error;
  return code === undefined ? message : `${message} (code ${code})`;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function read(url: URL): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" }).catch((cause: unknown) => {
    throw new ConnectorUnavailable("instagram", "upstream_error", `Instagram graph unreachable: ${String(cause)}`);
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ConnectorUnavailable(
      "instagram",
      response.status === 401 || response.status === 403 ? "forbidden" : "upstream_error",
      `Instagram refused the insights read: ${describe(payload, response.status)}`,
    );
  }
  return payload;
}

function insightsUrl(accessToken: string, params: Record<string, string>): URL {
  const url = new URL(`${GRAPH}/me/insights`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  return url;
}

/**
 * Reads the authorising account's own figures for the last `days` days.
 *
 * `/me/insights` resolves to whichever account the token belongs to, so no
 * account id is passed and none can be substituted — a creator cannot reach
 * somebody else's insights by editing a parameter, because the parameter does
 * not exist.
 *
 * `follower_count` is refused outright for an account under 100 followers,
 * which is a sizeable share of the creators this product indexes. A refusal
 * there must not cost the reader their reach series, so the daily call is
 * retried without it rather than failing the page; the column comes back null,
 * which is what "not measurable" renders as everywhere else here.
 */
export async function fetchInstagramInsights(
  accessToken: string,
  days = 28,
): Promise<InstagramInsights> {
  const window = Math.min(days, MAX_WINDOW_DAYS);
  const until = new Date();
  const since = new Date(until.getTime() - window * 86_400_000);
  const range = {
    period: "day",
    since: String(Math.floor(since.getTime() / 1000)),
    until: String(Math.floor(until.getTime() / 1000)),
  };

  let series: unknown;
  try {
    series = await read(insightsUrl(accessToken, { ...range, metric: "reach,follower_count" }));
  } catch (error) {
    if (error instanceof ConnectorUnavailable && error.reason === "forbidden") throw error;
    series = await read(insightsUrl(accessToken, { ...range, metric: "reach" }));
  }

  const totals = await read(
    insightsUrl(accessToken, {
      ...range,
      metric: "views,likes,comments,shares,saves",
      metric_type: "total_value",
    }),
  );

  return {
    from: isoDay(since),
    to: isoDay(until),
    days: mergeSeries(series),
    totals: readTotals(totals),
  };
}

/** One row per day, with a metric the API did not return left null rather than zeroed. */
function mergeSeries(payload: unknown): InstagramInsightDay[] {
  const parsed = Series.safeParse(payload);
  if (!parsed.success) return [];

  const byDay = new Map<string, InstagramInsightDay>();
  for (const metric of parsed.data.data) {
    for (const point of metric.values ?? []) {
      const date = point.end_time.slice(0, 10);
      const row = byDay.get(date) ?? { date, reach: null, followerCount: null };
      if (metric.name === "reach") row.reach = point.value;
      if (metric.name === "follower_count") row.followerCount = point.value;
      byDay.set(date, row);
    }
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function readTotals(payload: unknown): InstagramInsights["totals"] {
  const empty = { views: null, likes: null, comments: null, shares: null, saves: null };
  const parsed = Totals.safeParse(payload);
  if (!parsed.success) return empty;

  const field: Record<string, keyof InstagramInsights["totals"]> = {
    views: "views",
    likes: "likes",
    comments: "comments",
    shares: "shares",
    saves: "saves",
  };

  const out = { ...empty } as InstagramInsights["totals"];
  for (const metric of parsed.data.data) {
    const key = field[metric.name];
    const value = metric.total_value?.value;
    if (key && value !== undefined) out[key] = value;
  }
  return out;
}
