import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Parses Meta's `signed_request`, the payload it POSTs to the deauthorize and
 * data-deletion callbacks.
 *
 * It is not OAuth and carries no bearer token: the only thing proving the
 * request came from Meta is an HMAC over the payload, keyed with the app
 * secret. So the signature is checked before the body is read at all, and
 * compared in constant time — a callback that acts on an unverified payload is
 * an endpoint anyone can use to delete a creator's data by posting to it.
 */
export function parseSignedRequest(signed: string, appSecret: string): { user_id?: string } | null {
  const [encodedSig, payload] = signed.split(".", 2);
  if (!encodedSig || !payload) return null;

  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(encodedSig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user_id?: string };
  } catch {
    return null;
  }
}
