import { fetchVideosByIds } from "@/server/connectors/youtube";
import { ingestedRecords, upsertIngested } from "@/server/data/ingested-store";
import type { RawContent } from "@/server/data/records";
import { extractHashtags, extractMentions } from "@/server/services/ingestion-service";

/* ---------------------------------------------------------------------------
 * Keeping stored YouTube metadata inside its permitted age.
 *
 * YouTube's developer policy caps how long API Data may sit in a database.
 * Public statistics get a long allowance under the derived-metrics policy —
 * "publicly available stats (e.g., views, likes, comment counts) for up to 36
 * calendar months" — but everything else does not: "Other data (e.g., video
 * titles, creator names, comment text) still must follow the 30-day refresh
 * and deletion policy."
 *
 * SENSO stores titles, descriptions, hashtags and thumbnails for 437k videos
 * and has never re-read most of them. `refreshStale` re-reads a channel's
 * most recent 50 uploads, so anything older than a channel's last fifty posts
 * was written once at ingestion and left there.
 *
 * The policy allows deletion *or* refresh, and deletion would quietly break
 * the product: campaign attribution matches the tracking tag against stored
 * `hashtags` at read time, listening searches stored titles and captions, and
 * the semantic index is built from them. Deleting at thirty days would mean
 * campaign performance silently emptying out for any campaign older than a
 * month. Refreshing keeps all of it and costs almost nothing: `videos.list`
 * takes fifty ids for one quota unit, so the whole corpus is about 8,700
 * units a month — under 300 a day spread across the cycle.
 *
 * A video the API no longer returns has been deleted or made private by its
 * owner, and the row goes with it. That is the same obligation arriving from
 * the other direction, and the refresh is where we find out.
 * ------------------------------------------------------------------------ */

/** The policy's own number for non-statistic data. */
const MAX_AGE_DAYS = 30;

/** Refreshed a little early, so a slow day does not put a row over the line. */
const REFRESH_AT_DAYS = 25;

/** `videos.list` accepts fifty ids for a single quota unit. */
const BATCH = 50;

/*
 * A pass that finds more than this share of its videos missing is not
 * looking at a wave of deletions; it is looking at something wrong with the
 * request. A key restricted to the wrong API, a region block on the server's
 * address, or a malformed id batch all return a 200 with rows simply absent,
 * which is indistinguishable from "the owner took it down" — except by
 * volume. Real deletions are a trickle.
 *
 * Above the threshold the pass keeps the refreshes and abandons the
 * deletions, because the cost of being wrong is asymmetric: a stale row
 * survives until tomorrow, a deleted row is gone and the nightly pg_dump is
 * the only way back.
 */
const MAX_ABSENT_SHARE = 0.2;

/** Set to "false" to refresh without ever deleting, e.g. for a first run. */
const DELETION_ENABLED = process.env.SENSO_RETENTION_DELETE !== "false";

export interface RetentionReport {
  due: number;
  refreshed: number;
  removed: number;
  quotaUnitsSpent: number;
  /** Rows still past the refresh age when the pass ran out of budget. */
  remaining: number;
  /** Set when deletions were found but withheld, with the reason. */
  deletionsWithheld: number;
  withheldReason: string | null;
  oldestAgeDays: number | null;
  stoppedEarly: string | null;
}

/**
 * Age in days, with a finite stand-in for "never refreshed".
 *
 * Deliberately not Infinity. Every row written before this job existed is
 * unstamped, so on the first pass almost every comparison is one unstamped
 * row against another — and `Infinity - Infinity` is NaN, which makes the
 * sort comparator inconsistent and the ordering arbitrary. A large finite
 * number keeps those rows first and keeps the comparator well defined.
 */
const NEVER_REFRESHED_DAYS = 36_500;

function ageDays(iso: string | undefined, now: number): number {
  if (!iso) return NEVER_REFRESHED_DAYS;
  const parsed = new Date(iso).getTime();
  // An unparseable stamp is treated as never refreshed rather than as NaN,
  // which would compare false against every threshold and quietly exempt the
  // row from retention forever.
  if (Number.isNaN(parsed)) return NEVER_REFRESHED_DAYS;
  return (now - parsed) / 86_400_000;
}

/**
 * Rows whose metadata is older than the refresh age, oldest first.
 *
 * A row with no `refreshedAt` predates this job and is treated as infinitely
 * old, which is accurate: nothing has re-read it since it was ingested.
 */
function dueRows(now: number): RawContent[] {
  return ingestedRecords()
    .content.filter(
      (item) => item.platform === "youtube" && ageDays(item.refreshedAt, now) >= REFRESH_AT_DAYS,
    )
    .sort((a, b) => ageDays(b.refreshedAt, now) - ageDays(a.refreshedAt, now));
}

/** The YouTube video id inside a stored content id (`<accountId>_<videoId>`). */
function videoIdOf(content: RawContent): string | null {
  const cut = content.id.lastIndexOf("_");
  return cut === -1 ? null : content.id.slice(cut + 1) || null;
}

export async function refreshAgedContent(
  options: { budgetMs?: number; maxVideos?: number; now?: Date } = {},
): Promise<RetentionReport> {
  const budgetMs = options.budgetMs ?? 60_000;
  const maxVideos = options.maxVideos ?? 20_000;
  const now = (options.now ?? new Date()).getTime();
  const startedAt = Date.now();

  const due = dueRows(now);
  const report: RetentionReport = {
    due: due.length,
    refreshed: 0,
    removed: 0,
    quotaUnitsSpent: 0,
    remaining: due.length,
    deletionsWithheld: 0,
    withheldReason: null,
    oldestAgeDays: due.length ? Math.round(ageDays(due[0].refreshedAt, now)) : null,
    stoppedEarly: null,
  };
  if (due.length === 0) return report;

  const batch = due.slice(0, maxVideos);
  const refreshedAt = new Date(now).toISOString();
  const changed = new Map<string, RawContent>();
  const removed = new Set<string>();

  for (let i = 0; i < batch.length; i += BATCH) {
    if (Date.now() - startedAt > budgetMs) {
      report.stoppedEarly = `Time budget of ${budgetMs}ms reached.`;
      break;
    }

    const slice = batch.slice(i, i + BATCH);
    const wanted = new Map<string, RawContent>();
    for (const row of slice) {
      const videoId = videoIdOf(row);
      if (videoId) wanted.set(videoId, row);
    }
    if (wanted.size === 0) continue;

    const videos = await fetchVideosByIds([...wanted.keys()]);
    report.quotaUnitsSpent += 1;

    const seen = new Set<string>();
    for (const video of videos) {
      const row = wanted.get(video.videoId);
      if (!row) continue;
      seen.add(video.videoId);
      changed.set(row.id, {
        ...row,
        title: video.title,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        durationSeconds: video.durationSeconds,
        caption: video.description.slice(0, 400),
        hashtags: extractHashtags(video.description),
        mentions: extractMentions(video.description),
        refreshedAt,
      });
    }

    // Absent from the response: deleted, made private, or region-blocked for
    // this key. In every one of those cases the owner has withdrawn it, and
    // the stored copy has to go with it.
    for (const [videoId, row] of wanted) {
      if (!seen.has(videoId)) removed.add(row.id);
    }
  }

  // Decide about the deletions only once the whole pass is in, so the
  // judgement is made against the pass's own rate rather than one unlucky
  // batch of fifty.
  const inspected = changed.size + removed.size;
  const absentShare = inspected > 0 ? removed.size / inspected : 0;

  let deleting = removed;
  if (!DELETION_ENABLED) {
    report.deletionsWithheld = removed.size;
    report.withheldReason = "SENSO_RETENTION_DELETE=false";
    deleting = new Set();
  } else if (absentShare > MAX_ABSENT_SHARE) {
    report.deletionsWithheld = removed.size;
    report.withheldReason =
      `${Math.round(absentShare * 100)}% of inspected videos came back absent, over the ` +
      `${Math.round(MAX_ABSENT_SHARE * 100)}% threshold. Refreshes kept, deletions skipped.`;
    deleting = new Set();
  }

  if (changed.size > 0 || deleting.size > 0) {
    await writeBack(changed, deleting);
  }

  report.refreshed = changed.size;
  report.removed = deleting.size;
  const still = dueRows(Date.now());
  report.remaining = still.length;
  report.oldestAgeDays = still.length ? Math.round(ageDays(still[0].refreshedAt, Date.now())) : null;
  return report;
}

/**
 * Writes the refreshed rows back, per owner.
 *
 * `upsertIngested` replaces a creator's whole content set, so each affected
 * influencer is rebuilt from the rows currently held with the refreshed ones
 * swapped in and the withdrawn ones dropped. Rebuilding from the live store
 * rather than from a snapshot taken at the top of the pass matters: a harvest
 * writing in the meantime would otherwise have its new rows erased by a stale
 * copy.
 */
async function writeBack(
  changed: Map<string, RawContent>,
  removed: Set<string>,
): Promise<void> {
  const data = ingestedRecords();
  const touched = new Set<string>();
  for (const row of changed.values()) touched.add(row.influencerId);
  for (const row of data.content) if (removed.has(row.id)) touched.add(row.influencerId);

  const records = [];
  for (const influencerId of touched) {
    const influencer = data.influencers.find((item) => item.id === influencerId);
    const accounts = data.accounts.filter((item) => item.influencerId === influencerId);
    const snapshot = data.snapshots.find((item) => accounts.some((a) => a.id === item.accountId));
    if (!influencer || accounts.length === 0 || !snapshot) continue;

    const content = data.content
      .filter((item) => item.influencerId === influencerId && !removed.has(item.id))
      .map((item) => changed.get(item.id) ?? item);

    records.push({ influencer, accounts, snapshot, content });
  }
  if (records.length > 0) await upsertIngested(records);
}

/** Rows already past the hard limit, for the health endpoint to report. */
export function overdueContentCount(now = Date.now()): number {
  return ingestedRecords().content.filter(
    (item) => item.platform === "youtube" && ageDays(item.refreshedAt, now) >= MAX_AGE_DAYS,
  ).length;
}
