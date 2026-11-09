import { describe, expect, it } from "vitest";

/*
 * The retention pass decides which stored rows get overwritten and which get
 * deleted, so the selection rules are worth pinning even though the network
 * call is not exercised here.
 *
 * These mirror the two judgements the service makes before it touches
 * anything: how old a row counts as, and which video a row belongs to.
 */

const REFRESH_AT_DAYS = 25;
const NEVER_REFRESHED_DAYS = 36_500;

function ageDays(iso: string | undefined, now: number): number {
  if (!iso) return NEVER_REFRESHED_DAYS;
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return NEVER_REFRESHED_DAYS;
  return (now - parsed) / 86_400_000;
}

function videoIdOf(id: string): string | null {
  const cut = id.lastIndexOf("_");
  return cut === -1 ? null : id.slice(cut + 1) || null;
}

describe("age selection", () => {
  const now = Date.parse("2026-11-09T00:00:00.000Z");
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

  it("treats a row that was never refreshed as very old, but finitely so", () => {
    // Every row written before this job existed carries no stamp, and those
    // are exactly the rows most likely to be past thirty days. The value is
    // finite on purpose: Infinity - Infinity is NaN, and on the first pass
    // almost every comparison is one unstamped row against another.
    expect(ageDays(undefined, now)).toBe(NEVER_REFRESHED_DAYS);
    expect(Number.isFinite(ageDays(undefined, now))).toBe(true);
    expect(ageDays(undefined, now) >= REFRESH_AT_DAYS).toBe(true);
  });

  it("treats an unparseable stamp as never refreshed, not as NaN", () => {
    // NaN compares false against every threshold, which would exempt the row
    // from retention permanently — the opposite of what a bad stamp deserves.
    expect(ageDays("not-a-date", now)).toBe(NEVER_REFRESHED_DAYS);
  });

  it("refreshes before the thirty-day limit, not at it", () => {
    // A pass that waited for day 30 would put rows over the line whenever it
    // was cut short by its time budget.
    expect(ageDays(daysAgo(26), now) >= REFRESH_AT_DAYS).toBe(true);
    expect(ageDays(daysAgo(24), now) >= REFRESH_AT_DAYS).toBe(false);
  });

  it("orders the oldest first, with unstamped rows ahead of the rest", () => {
    // Rows, not bare strings: sort() moves undefined *elements* to the end
    // without consulting the comparator at all, so an array of raw values
    // would test the engine rather than this rule.
    const rows = [{ refreshedAt: daysAgo(26) }, { refreshedAt: undefined }, { refreshedAt: daysAgo(40) }];
    const sorted = [...rows].sort((a, b) => ageDays(b.refreshedAt, now) - ageDays(a.refreshedAt, now));
    expect(sorted.map((r) => r.refreshedAt)).toEqual([undefined, daysAgo(40), daysAgo(26)]);
  });

  it("keeps the comparator defined when every row is unstamped", () => {
    const rows = [{ refreshedAt: undefined }, { refreshedAt: undefined }];
    const compared = ageDays(rows[0].refreshedAt, now) - ageDays(rows[1].refreshedAt, now);
    expect(Number.isNaN(compared)).toBe(false);
  });
});

describe("video id extraction", () => {
  it("takes the id after the last underscore, since account ids contain them", () => {
    expect(videoIdOf("yt_UCabc123_dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null rather than a wrong id when the shape is unexpected", () => {
    // A null means the row is skipped. Guessing would send a malformed id to
    // the API and, worse, mark a row absent and delete it.
    expect(videoIdOf("novideoid")).toBeNull();
    expect(videoIdOf("trailing_")).toBeNull();
  });
});

/*
 * The deletion guard. A 200 response with rows simply absent is what both a
 * deleted video and a misconfigured key look like, and only the volume tells
 * them apart — so the pass refuses to act on a share that cannot plausibly
 * be real deletions.
 */
describe("deletion guard", () => {
  const MAX_ABSENT_SHARE = 0.2;
  const share = (absent: number, refreshed: number) =>
    absent + refreshed > 0 ? absent / (absent + refreshed) : 0;

  it("allows the trickle of genuine deletions through", () => {
    expect(share(3, 497) > MAX_ABSENT_SHARE).toBe(false);
  });

  it("withholds when most of the batch comes back missing", () => {
    // A key restricted to the wrong API returns this shape, and acting on it
    // would delete the corpus.
    expect(share(480, 20) > MAX_ABSENT_SHARE).toBe(true);
  });

  it("does not divide by zero on an empty pass", () => {
    expect(share(0, 0)).toBe(0);
  });
});
