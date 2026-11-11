import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { parseSignedRequest } from "@/server/connectors/instagram/signed-request";
import { revokeInstagramByPlatformUser } from "@/server/services/instagram-connection-service";

/**
 * Meta's data deletion request callback.
 *
 * What SENSO holds for a connected creator that came from *their grant* is the
 * sealed token and the connection flags, and those are what this deletes. The
 * public profile stays, because it was never read from the grant — it comes
 * from Business Discovery and from YouTube, the same way an unconnected
 * creator's does, and deleting the index entry would be deleting a record the
 * person never gave us in the first place.
 *
 * Meta requires a confirmation code and a URL a person can check the status
 * at. The code is derived from the user id rather than stored, so a second
 * request for the same account returns the same code with nothing to keep.
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

  const code = createHash("sha256").update(`${payload.user_id}:${secret}`).digest("hex").slice(0, 16);
  const base = process.env.APP_URL?.trim() ?? "https://senso360.com";

  return NextResponse.json({
    url: `${base}/privacy#data-deletion`,
    confirmation_code: code,
  });
}
