import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueState } from "./connection-service";
import { verifyInstagramState } from "./instagram-connection-service";

/**
 * The state namespace, which is the part a mistake turns into a security hole.
 *
 * The consent step needs a person at Instagram's sign-in page, so the round
 * trip is not exercised here. What is exercised is the boundary between the
 * two platforms' states: both are signed with the same secret, so the prefix
 * is the only thing stopping a state minted for one flow completing the other
 * — and a YouTube state accepted here would attach an Instagram grant to a
 * creator who consented to something else entirely.
 */

describe("instagram connection state", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "a-test-secret-of-at-least-32-characters"));
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a YouTube state, which carries a valid signature", () => {
    expect(verifyInstagramState(issueState("yt_UCabc"))).toBeNull();
  });

  it("accepts its own state", () => {
    expect(verifyInstagramState(`ig:${issueState("yt_UCabc")}`)).toEqual({
      influencerId: "yt_UCabc",
    });
  });

  it("refuses a prefix bolted onto an unsigned payload", () => {
    const forged = `ig:${Buffer.from(`yt_victim:${Date.now()}:x`).toString("base64url")}.forged`;
    expect(verifyInstagramState(forged)).toBeNull();
  });

  it("refuses a bare state with no prefix at all", () => {
    expect(verifyInstagramState("")).toBeNull();
  });
});
