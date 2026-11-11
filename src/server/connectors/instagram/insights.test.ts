import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchInstagramInsights } from "./insights";

/**
 * The parsing is where a figure can be invented. Instagram returns one shape
 * for a daily metric and another for a windowed total, refuses
 * `follower_count` outright below 100 followers, and omits a metric it has
 * nothing for — so what is asserted here is that each of those arrives as
 * absent rather than as a zero somebody could quote.
 */

function reply(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchInstagramInsights", () => {
  it("merges the daily metrics by day and sums the window's totals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        String(url).includes("total_value")
          ? reply({
              data: [
                { name: "views", total_value: { value: 1200 } },
                { name: "likes", total_value: { value: 95 } },
              ],
            })
          : reply({
              data: [
                {
                  name: "reach",
                  values: [
                    { value: 10, end_time: "2026-11-09T08:00:00+0000" },
                    { value: 20, end_time: "2026-11-10T08:00:00+0000" },
                  ],
                },
                {
                  name: "follower_count",
                  values: [{ value: 3, end_time: "2026-11-10T08:00:00+0000" }],
                },
              ],
            }),
      ),
    );

    const result = await fetchInstagramInsights("IGAAtoken", 28);

    expect(result.days).toEqual([
      { date: "2026-11-09", reach: 10, followerCount: null },
      { date: "2026-11-10", reach: 20, followerCount: 3 },
    ]);
    // Absent is not zero: a metric the window did not report stays null.
    expect(result.totals).toEqual({
      views: 1200,
      likes: 95,
      comments: null,
      shares: null,
      saves: null,
    });
  });

  it("drops follower_count and keeps reach when the account is too small for it", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        const href = String(url);
        calls.push(href);
        if (href.includes("total_value")) return reply({ data: [] });
        if (href.includes("follower_count")) {
          return reply({ error: { message: "Not enough followers", code: 100 } }, false, 400);
        }
        return reply({
          data: [{ name: "reach", values: [{ value: 7, end_time: "2026-11-10T08:00:00+0000" }] }],
        });
      }),
    );

    const result = await fetchInstagramInsights("IGAAtoken", 28);

    expect(calls.some((href) => href.includes("follower_count"))).toBe(true);
    expect(result.days).toEqual([{ date: "2026-11-10", reach: 7, followerCount: null }]);
  });

  it("surfaces a revoked grant rather than retrying it as a smaller request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ error: { message: "Invalid OAuth access token", code: 190 } }, false, 401)),
    );

    await expect(fetchInstagramInsights("IGAAtoken", 28)).rejects.toMatchObject({
      reason: "forbidden",
    });
  });
});
