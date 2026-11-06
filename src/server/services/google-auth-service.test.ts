import { describe, expect, it } from "vitest";
import { issueState, roleFor, verifyState } from "./google-auth-service";
import { issueClaimState, verifyClaimState } from "./claim-service";

/*
 * The state is the only thing standing between this flow and a third party
 * feeding somebody's browser a callback for an account they control. These
 * check the properties that matter, not the encoding.
 */
describe("google sign-in state", () => {
  it("round-trips the intent and the return path", () => {
    const state = issueState("brand", "/pricing");
    expect(verifyState(state)).toEqual({ intent: "brand", returnTo: "/pricing" });
  });

  it("rejects a state this server did not sign", () => {
    const forged = Buffer.from("creator:" + Date.now() + ":x:").toString("base64url") + ".notasignature";
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects a tampered payload under a valid-looking signature", () => {
    const [payload, signature] = issueState("creator", "").split(".");
    const swapped = Buffer.from(
      Buffer.from(payload, "base64url").toString("utf8").replace("creator", "brand"),
    ).toString("base64url");
    expect(verifyState(`${swapped}.${signature}`)).toBeNull();
  });

  it("drops an off-site return path rather than following it", () => {
    // An open redirect here would hand a phisher a senso360.com link that
    // lands on their page with a fresh session already set.
    expect(verifyState(issueState("creator", "https://evil.example"))?.returnTo).toBe("");
    expect(verifyState(issueState("creator", "//evil.example"))?.returnTo).toBe("");
  });

  it("maps the two doors onto the two roles", () => {
    expect(roleFor("creator")).toBe("influencer");
    expect(roleFor("brand")).toBe("client_owner");
  });
});

/*
 * Both flows are signed with the same secret and land on the same callback,
 * so neither may be accepted in the other's place: a claim replayed as a
 * connection would attach a channel to whichever record the connection
 * started from, skipping the ownership check entirely.
 */
describe("claim state is not interchangeable with sign-in state", () => {
  it("a claim state does not verify as a sign-in state", () => {
    expect(verifyState(issueClaimState("usr_1"))).toBeNull();
  });

  it("a sign-in state does not verify as a claim state", () => {
    expect(verifyClaimState(issueState("creator", ""))).toBeNull();
  });

  it("round-trips the user id it was issued for", () => {
    expect(verifyClaimState(issueClaimState("usr_42"))).toEqual({ userId: "usr_42" });
  });
});
