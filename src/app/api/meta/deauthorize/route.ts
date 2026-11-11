import { NextResponse } from "next/server";
import { parseSignedRequest } from "@/server/connectors/instagram/signed-request";
import { revokeInstagramByPlatformUser } from "@/server/services/instagram-connection-service";

/**
 * Meta calls this when a creator removes SENSO from their Instagram account.
 *
 * It is the other end of the Disconnect button, and it exists so the two
 * sides cannot disagree: a grant revoked at Instagram must stop being a
 * connection here, or the profile keeps a verified badge nobody consented to
 * any more. Unauthenticated by design — the signature is the authentication.
 */
export async function POST(request: Request) {
  const secret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  if (typeof signed !== "string") {
    return NextResponse.json({ error: "missing_signed_request" }, { status: 400 });
  }

  const payload = parseSignedRequest(signed, secret);
  if (!payload?.user_id) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  await revokeInstagramByPlatformUser(payload.user_id);
  return NextResponse.json({ ok: true });
}
