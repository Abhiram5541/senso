import { shared } from "@/server/data/process-store";
import {
  ensureJobsSchema,
  postgresDriver,
  readJobRun,
  writeJobRun,
  type JobRun,
} from "@/server/data/postgres";
import { PLANS } from "./discovery-plan";
import {
  harvest,
  refreshInstagramStale,
  refreshStale,
  type DiscoveryQuery,
  type HarvestReport,
  type StaleRefreshReport,
} from "./harvest-service";
import { sendAlertDigests, type DigestReport } from "./digest-service";
import { sendOpsEvent } from "./notification-service";

/* ---------------------------------------------------------------------------
 * The two things the database needs done every day, and a clock to do them.
 *
 * `snapshot` re-reads every account not yet read today, which is the only
 * way a growth history is ever built. `discover` runs the next few searches
 * of a fixed rotation so new creators keep arriving without anyone sweeping
 * by hand. Both spend the shared YouTube quota, so both are capped, run at
 * most once per UTC day, and record that they ran.
 *
 * Two ways to fire them. On a long-lived server, `startScheduler` (from
 * instrumentation.ts) checks every quarter hour whether today's runs are still
 * owed — a laptop that was asleep at the scheduled hour catches up when it
 * wakes. On Vercel, the cron routes under /api/internal/cron call the same
 * functions, and the same bookkeeping stops a route and a timer doubling up.
 * ------------------------------------------------------------------------ */

/**
 * YouTube's quota resets at midnight Pacific — 07:00 or 08:00 UTC. Running
 * after that means a day's budget is whole when the jobs start.
 */
export const JOBS_HOUR_UTC = Number(process.env.SOCIALORBIT_DAILY_JOBS_HOUR_UTC ?? 9);

/**
 * Searches per day. Thirty is ~4,500 units with the reads behind them (a
 * search is 100 units; the channel reads for what it finds are ~1,500 more),
 * which leaves ~5,500 of a 10,000 budget for the snapshot pass that now runs
 * second. Raised from ten (D50) to grow the TG/AP list faster; the knob is the
 * env var, and the ceiling is the daily quota — past ~60 the snapshot starves.
 * ponytail: single YouTube key = 10k/day ceiling; a second key is the way up.
 */
const SEARCHES_PER_DAY = Number(process.env.SOCIALORBIT_DISCOVERY_SEARCHES_PER_DAY ?? 30);

/** Every query the rotation walks: the TG/AP places, then the same places by size (D50). */
export const ROTATION: DiscoveryQuery[] = [...PLANS.places, ...PLANS.top];

/**
 * Today's slice of the rotation, derived from the date rather than a stored
 * cursor: two servers, or a cron and a timer, pick the same queries for the
 * same day and the bookkeeping below stops the second from spending on them.
 */
export function queriesForDay(day: string, perDay = SEARCHES_PER_DAY): DiscoveryQuery[] {
  const index = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000);
  const start = (index * perDay) % ROTATION.length;
  return Array.from({ length: Math.min(perDay, ROTATION.length) }, (_, i) => ROTATION[(start + i) % ROTATION.length]);
}

/* --- Bookkeeping -------------------------------------------------------- */

function memoryRuns(): Map<string, JobRun> {
  return shared("job_runs", () => new Map<string, JobRun>());
}

export async function lastRun(name: string): Promise<JobRun | null> {
  if (!postgresDriver()) return memoryRuns().get(name) ?? null;
  await ensureJobsSchema();
  return readJobRun(name);
}

async function recordRun(run: JobRun): Promise<void> {
  if (!postgresDriver()) {
    memoryRuns().set(run.name, run);
    return;
  }
  await ensureJobsSchema();
  await writeJobRun(run);
}

const today = (now: Date) => now.toISOString().slice(0, 10);

/* --- Jobs --------------------------------------------------------------- */

/**
 * Re-reads every account without a reading from today. A generous budget:
 * this is the long-lived-server version, and 2,400 channels take about
 * twenty minutes. The Vercel cron passes its own, smaller one.
 */
export async function runSnapshotJob(
  now = new Date(),
  options: { budgetMs?: number; maxChannels?: number } = {},
): Promise<StaleRefreshReport | null> {
  const day = today(now);
  if ((await lastRun("snapshot"))?.ranOn === day) return null;

  const maxChannels = options.maxChannels ?? 5_000;
  const report = await refreshStale({ budgetMs: options.budgetMs ?? 40 * 60_000, maxChannels });

  if (!snapshotCutShort(report, maxChannels)) await recordRun({ name: "snapshot", ranOn: day, report });

  // Instagram accounts, when the token is configured. A separate budget (its
  // own rate limit), so it neither waits for nor competes with the YouTube pass.
  const instagram = process.env.META_IG_TOKEN ? await refreshInstagramStale() : null;

  await sendOpsEvent("Daily snapshot", [
    `${report.ingested} creators refreshed, ${report.quotaUnitsSpent} quota units spent.`,
    ...(instagram ? [`Instagram: ${instagram.ingested} refreshed, ${instagram.remaining} still due.`] : []),
    report.remaining > 0
      ? `${report.remaining} still carrying an older reading.`
      : "Every account holds a reading from today.",
    ...(report.stoppedEarly ? [`Stopped early: ${report.stoppedEarly}`] : []),
  ]);
  return report;
}

/**
 * A pass cut short — by its time budget, by an unreachable API, or by its
 * channel cap with accounts still owed — is not today's run; the next tick or
 * cron call continues it. Anything else is: done, or the quota is gone for the
 * day. (Not simply "remaining === 0": a channel that hides its subscriber
 * count is refused on every read, and would keep the job re-running all day.)
 */
export function snapshotCutShort(
  report: Pick<StaleRefreshReport, "stoppedEarly" | "discovered" | "remaining">,
  maxChannels: number,
): boolean {
  const stopped = report.stoppedEarly;
  if (stopped && !stopped.includes("quota exhausted")) return true;
  return report.discovered === maxChannels && report.remaining > 0;
}

/** Runs today's slice of the discovery rotation. */
export async function runDiscoveryJob(now = new Date()): Promise<HarvestReport | null> {
  const day = today(now);
  if ((await lastRun("discover"))?.ranOn === day) return null;

  const queries = queriesForDay(day);
  const report = await harvest({ queries, target: 500 });
  await recordRun({ name: "discover", ranOn: day, report: { ...report, queries: queries.map((q) => q.q) } });

  await sendOpsEvent("Daily discovery", [
    `${queries.length} searches: ${report.discovered} channels found, ${report.ingested} new creators added, ${report.quotaUnitsSpent} quota units spent.`,
    ...(report.stoppedEarly ? [`Stopped early: ${report.stoppedEarly}`] : []),
  ]);
  return report;
}

/** Emails each client user the alerts that are new since their last digest. */
export async function runDigestJob(now = new Date()): Promise<DigestReport | null> {
  const day = today(now);
  if ((await lastRun("digest"))?.ranOn === day) return null;
  const report = await sendAlertDigests(now);
  await recordRun({ name: "digest", ranOn: day, report });
  return report;
}

/* --- Clock -------------------------------------------------------------- */

const TICK_MS = 15 * 60_000;

/**
 * Starts the in-process clock. Idempotent across hot reloads — the timer
 * lives on the process-wide store — and unref'd so it never keeps a process
 * alive on its own. Only runs on a server that has a YouTube key and asked
 * for it: a test run or a fresh clone must not spend quota by surprise.
 */
export function startScheduler(): void {
  if (process.env.SOCIALORBIT_DAILY_JOBS !== "true") return;
  // The platform jobs spend YouTube quota and need the key; the digest does
  // not, so a server without one still mails its alerts.
  const platformJobs = Boolean(process.env.YOUTUBE_API_KEY?.trim());

  const state = shared("scheduler", () => ({ timer: null as NodeJS.Timeout | null, busy: false }));
  if (state.timer) return;

  const tick = async () => {
    const now = new Date();
    if (now.getUTCHours() < JOBS_HOUR_UTC || state.busy) return;
    state.busy = true;
    try {
      if (platformJobs) {
        // Discover first (D50): it takes its capped slice of the quota before
        // the snapshot refresh of every existing account can spend the day's
        // budget, so new TG/AP creators keep arriving. The snapshot runs on
        // what is left and resumes next tick when the quota cuts it short.
        const discovery = await runDiscoveryJob(now);
        if (discovery) console.log(`[jobs] discover: ${discovery.ingested} new creators`);
        const snapshot = await runSnapshotJob(now);
        if (snapshot) console.log(`[jobs] snapshot: ${snapshot.ingested} read, ${snapshot.remaining} remaining`);
      }
      // Scheduled reports are queued rather than generated here: the daily
      // clock decides *what is due*, the queue decides when it runs.
      const { applyDuePlanChanges } = await import("./billing-service");
      const downgrades = await applyDuePlanChanges(now);
      if (downgrades > 0) console.log(`[jobs] billing: ${downgrades} scheduled plan changes applied`);

      const { queueDueReports } = await import("./report-service");
      const queued = queueDueReports(now);
      if (queued > 0) console.log(`[jobs] queued ${queued} scheduled report(s)`);

      const digest = await runDigestJob(now);
      if (digest) console.log(`[jobs] digest: ${digest.emailed} of ${digest.users} users emailed, ${digest.alerts} alerts`);
    } catch (error) {
      console.error(`[jobs] daily run failed: ${String(error)}`);
    } finally {
      state.busy = false;
    }
  };

  state.timer = setInterval(tick, TICK_MS);
  state.timer.unref();
  void tick();
  console.log(`[jobs] daily scheduler armed — runs after ${String(JOBS_HOUR_UTC).padStart(2, "0")}:00 UTC, ${SEARCHES_PER_DAY} searches/day`);
}
