import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "./signed-request";

const SECRET = "an-instagram-app-secret";

function sign(payload: object, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
}

/**
 * The signature is the only authentication these callbacks have, so the thing
 * worth asserting is that a payload which was not signed with our secret
 * cannot reach the revocation path.
 */
describe("parseSignedRequest", () => {
  it("reads a payload signed with the app secret", () => {
    expect(parseSignedRequest(sign({ user_id: "17841400000000000" }), SECRET)).toEqual({
      user_id: "17841400000000000",
    });
  });

  it("refuses a payload signed with another secret", () => {
    expect(parseSignedRequest(sign({ user_id: "17841400000000000" }, "wrong"), SECRET)).toBeNull();
  });

  it("refuses a payload whose body was swapped after signing", () => {
    const [sig] = sign({ user_id: "victim" }).split(".");
    const forged = Buffer.from(JSON.stringify({ user_id: "attacker" })).toString("base64url");
    expect(parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull();
  });

  it("refuses malformed input", () => {
    expect(parseSignedRequest("", SECRET)).toBeNull();
    expect(parseSignedRequest("nodot", SECRET)).toBeNull();
  });
});
