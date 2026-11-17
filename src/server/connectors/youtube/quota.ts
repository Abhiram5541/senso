/* ---------------------------------------------------------------------------
 * The day's quota, and the slice of it that background work may not touch.
 *
 * YouTube charges every call in this project against one 10,000-unit daily
 * budget, whichever credential made it: the API key the snapshot and discovery
 * passes use, and the creator's own OAuth token during a connection. Those
 * passes are sized in channels and minutes, not units, so on a large index
 * they spend the whole budget — and the next creator who consents gets
 * `quotaExceeded` on the identity check and cannot be verified. That is the
 * feature the OAuth scopes exist for, so it is the one thing that must never
 * lose the race against a cron.
 *
 * So background work stops at the limit minus a reserve, and user-facing work
 * spends from the reserve. The accounting is deliberately simple: this process
 * is the only one holding the key (a second PM2 worker is refused at boot), and
 * YouTube's own `quotaExceeded` remains the backstop if the count drifts.
 *
 * ponytail: in-process counter, so a restart forgets the day's spend and the
 * reserve can be over-committed until the next reset. Persist it in app_state
 * if deploys ever become frequent enough for that to matter.
 * ------------------------------------------------------------------------ */

const DEFAULT_LIMIT = 10_000;
const DEFAULT_RESERVE = 1_000;

function limit(): number {
  const raw = Number(process.env.SOCIALORBIT_YOUTUBE_DAILY_QUOTA ?? DEFAULT_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LIMIT;
}

function reserve(): number {
  const raw = Number(process.env.SOCIALORBIT_YOUTUBE_QUOTA_RESERVE ?? DEFAULT_RESERVE);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_RESERVE;
  // A reserve at or above the limit would stop background work entirely.
  return Math.min(raw, Math.floor(limit() / 2));
}

/**
 * The quota day, which is Pacific, not UTC.
 *
 * Google resets this budget at midnight Pacific Time. Counting in UTC would
 * hold the reserve shut for up to eight hours after YouTube had already
 * refilled it, which on a product whose creators connect in the evening is
 * exactly the wrong eight hours.
 */
export function quotaDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

interface Ledger {
  day: string;
  spent: number;
}

let ledger: Ledger = { day: quotaDay(), spent: 0 };

function current(): Ledger {
  const day = quotaDay();
  if (ledger.day !== day) ledger = { day, spent: 0 };
  return ledger;
}

export type QuotaKind = "background" | "interactive";

/** Records units actually charged by a call that was made. */
export function recordSpend(units: number): void {
  current().spent += units;
}

/**
 * Whether a call of this cost may proceed.
 *
 * Background work is held back at the reserve; interactive work may use the
 * whole budget, because by the time a creator is on the consent screen the
 * alternative to spending is telling them the product does not work.
 */
export function canSpend(units: number, kind: QuotaKind): boolean {
  const ceiling = kind === "interactive" ? limit() : limit() - reserve();
  return current().spent + units <= ceiling;
}

export function quotaStatus(): {
  day: string;
  spent: number;
  limit: number;
  reserve: number;
  backgroundRemaining: number;
} {
  const { day, spent } = current();
  return {
    day,
    spent,
    limit: limit(),
    reserve: reserve(),
    backgroundRemaining: Math.max(0, limit() - reserve() - spent),
  };
}

/** Test seam: the ledger is module state and tests must not inherit each other's. */
export function resetQuotaLedger(): void {
  ledger = { day: quotaDay(), spent: 0 };
}
