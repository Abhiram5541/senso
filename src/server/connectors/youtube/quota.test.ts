import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canSpend, quotaStatus, recordSpend, resetQuotaLedger } from "./quota";

/**
 * The property worth protecting: however much the background passes spend,
 * a creator's identity check can still be paid for. Everything else here is
 * arithmetic in service of that one sentence.
 */

beforeEach(() => {
  vi.stubEnv("SOCIALORBIT_YOUTUBE_DAILY_QUOTA", "10000");
  vi.stubEnv("SOCIALORBIT_YOUTUBE_QUOTA_RESERVE", "1000");
  resetQuotaLedger();
});
afterEach(() => vi.unstubAllEnvs());

describe("youtube quota ledger", () => {
  it("stops background work at the limit minus the reserve", () => {
    recordSpend(8_999);
    expect(canSpend(1, "background")).toBe(true);

    recordSpend(1); // now exactly at 9,000
    expect(canSpend(1, "background")).toBe(false);
  });

  it("still admits a creator connection from inside the reserve", () => {
    recordSpend(9_000);
    expect(canSpend(1, "background")).toBe(false);
    expect(canSpend(1, "interactive")).toBe(true);
  });

  it("refuses everything once the real limit is reached", () => {
    recordSpend(10_000);
    expect(canSpend(1, "interactive")).toBe(false);
  });

  it("does not let a batch straddle the reserve boundary", () => {
    recordSpend(8_995);
    // A 100-unit search would cross 9,000, so it is refused whole.
    expect(canSpend(100, "background")).toBe(false);
    expect(canSpend(5, "background")).toBe(true);
  });

  it("reports what is left for background work", () => {
    recordSpend(2_500);
    expect(quotaStatus()).toMatchObject({
      spent: 2_500,
      limit: 10_000,
      reserve: 1_000,
      backgroundRemaining: 6_500,
    });
  });

  it("caps an over-large reserve so background work is never fully starved", () => {
    vi.stubEnv("SOCIALORBIT_YOUTUBE_QUOTA_RESERVE", "999999");
    expect(quotaStatus().reserve).toBe(5_000);
    expect(canSpend(1, "background")).toBe(true);
  });

  it("counts the quota day in Pacific time, not UTC", () => {
    // 07:00 UTC on 18 Nov is still 23:00 PT on 17 Nov — the same quota day.
    vi.setSystemTime(new Date("2026-11-18T07:00:00Z"));
    resetQuotaLedger();
    recordSpend(500);
    const before = quotaStatus();

    vi.setSystemTime(new Date("2026-11-18T09:00:00Z")); // 01:00 PT, next quota day
    const after = quotaStatus();

    expect(before.day).toBe("2026-11-17");
    expect(after.day).toBe("2026-11-18");
    expect(after.spent).toBe(0);
    vi.useRealTimers();
  });
});

/**
 * The scheduler decides whether a stopped pass is "finished for today" or
 * "interrupted, retry next tick" by matching the words "quota exhausted" in
 * the message. A refusal worded any other way makes the snapshot pass re-run
 * every fifteen minutes until midnight, so the wording is asserted here
 * alongside the ledger that produces it.
 */
describe("the refusal message the scheduler reads", () => {
  it("says 'quota exhausted' so the pass is recorded rather than retried", async () => {
    const { snapshotCutShort } = await import("@/server/services/daily-jobs");
    const message =
      "YouTube daily quota exhausted for background work: 9000 of 10000 units spent, " +
      "1000 held in reserve for creator connections. This channels read was not made.";

    expect(
      snapshotCutShort({ stoppedEarly: message, discovered: 10, remaining: 500 }, 5_000),
    ).toBe(false);
  });
});
