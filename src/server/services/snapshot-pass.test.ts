import { describe, expect, it, vi } from "vitest";

/*
 * The cheap growth pass. What is worth locking in is its price and its blast
 * radius: one quota unit per fifty accounts rather than two per account, and
 * snapshot rows only — a write through `upsertIngested` would delete every
 * post of every creator it touched.
 */

const accounts = Array.from({ length: 120 }, (_, i) => ({
  id: `acc_${i}`,
  influencerId: `inf_${i}`,
  platform: "youtube",
  platformAccountId: `UC${i}`,
  handle: `c${i}`,
  url: `https://youtube.com/@c${i}`,
  isPrimary: true,
  isConnected: false,
  connectedAt: null,
  needsReauth: false,
  followers: 1_000 + i,
  totalViews: 10_000 + i,
  contentCount: 10,
  lastSyncedAt: "2026-10-01T00:00:00.000Z",
}));

const today = new Date().toISOString().slice(0, 10);

// acc_0 already read today; acc_1 is gone from the platform; acc_2 hides its
// subscriber count. Everyone else is an ordinary due account.
const snapshots = [{ accountId: "acc_0", date: today, followers: 1, views: 1, contentCount: 1 }];

const fetched: string[][] = [];
const written: unknown[][] = [];
const unavailable: string[][] = [];

vi.mock("@/server/connectors/youtube", () => ({
  ConnectorUnavailable: class ConnectorUnavailable extends Error {},
  fetchChannels: (ids: string[]) => {
    fetched.push(ids);
    return Promise.resolve(
      ids
        .filter((id) => id !== "UC1")
        .map((id) => ({
          channelId: id,
          subscribers: id === "UC2" ? null : 5_000,
          totalViews: 99_000,
          videoCount: 42,
        })),
    );
  },
  discoverChannelIds: () => Promise.resolve([]),
  fetchChannel: () => Promise.resolve(null),
  parseChannelInput: (v: string) => v,
  fetchRecentVideos: () => Promise.resolve([]),
}));

vi.mock("@/server/connectors/instagram", () => ({
  ConnectorUnavailable: class ConnectorUnavailable extends Error {},
}));

vi.mock("@/server/data/ingested-store", () => ({
  ingestedRecords: () => ({ accounts, snapshots, influencers: [], content: [] }),
  upsertSnapshots: (points: unknown[]) => {
    written.push(points);
    return Promise.resolve();
  },
  upsertAccounts: (rows: { platformAccountId: string }[]) => {
    unavailable.push(rows.map((row) => row.platformAccountId));
    return Promise.resolve();
  },
  upsertIngested: () => {
    throw new Error("snapshotStale must never write through upsertIngested: it deletes content");
  },
  upsertViewHistory: () => Promise.resolve(),
}));

vi.mock("@/server/data/records", () => ({ readRecords: () => ({ accounts, influencers: [], content: [] }) }));
vi.mock("./ingestion-service", () => ({
  IngestionRefused: class IngestionRefused extends Error {},
  buildRecord: () => {
    throw new Error("the cheap pass must not build full records");
  },
  ingestInstagramAccount: () => Promise.resolve(null),
}));

describe("snapshotStale", () => {
  it("prices the whole roster at one unit per fifty, and writes snapshots only", async () => {
    const { snapshotStale } = await import("./harvest-service");
    const report = await snapshotStale();

    // 120 accounts, one already read today → 119 due, three batches.
    expect(report.due).toBe(119);
    expect(fetched).toHaveLength(3);
    expect(report.quotaUnitsSpent).toBe(3);

    // The point of the change: the content path would have charged ~2 units an
    // account for the same readings.
    expect(report.quotaUnitsSpent).toBeLessThan(report.due * 2);

    // UC1 vanished, UC2 withheld its count, so 117 points for 119 due.
    expect(report.vanished).toBe(1);
    expect(report.withheld).toBe(1);
    expect(report.written).toBe(117);
    expect(unavailable.flat()).toEqual(["UC1"]);

    const points = written.flat() as { accountId: string; followers: number; date: string }[];
    expect(points).toHaveLength(117);
    expect(points.every((point) => point.date === today)).toBe(true);
    expect(points.every((point) => point.followers === 5_000)).toBe(true);
    // An account already holding today's reading is not asked for again.
    expect(points.some((point) => point.accountId === "acc_0")).toBe(false);
    // A hidden subscriber count is absent, not zero.
    expect(points.some((point) => point.accountId === "acc_2")).toBe(false);
  });
});
