import { NextResponse, type NextRequest } from "next/server";
import {
  GoogleAuthUnavailable,
  authorizationUrl,
  issueState,
  publicOrigin,
} from "@/server/services/google-auth-service";
import { checkRateLimit } from "@/server/services/rate-limit";

/**
 * Sends a visitor to Google to sign in or sign up.
 *
 * A GET redirect rather than a JSON endpoint: it is reached from a link on
 * the sign-up page, and the browser must end up on Google's own origin for
 * the consent to mean anything.
 *
 * `intent` decides which kind of account is created if this is a first visit,
 * and is carried in the signed state because Google will not return it. It is
 * read from the query here and nowhere after: on the way back, only the
 * signature is trusted.
 */
export async function GET(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limit = checkRateLimit(`google-start:${key}`, { max: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.redirect(new URL("/signup?error=rate_limited", publicOrigin(request.nextUrl.origin)));
  }

  const raw = request.nextUrl.searchParams.get("intent");
  const intent = raw === "brand" ? "brand" : "creator";
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "";

  try {
    const state = issueState(intent, returnTo);
    return NextResponse.redirect(authorizationUrl(request.nextUrl.origin, state));
  } catch (error) {
    if (error instanceof GoogleAuthUnavailable) {
      return NextResponse.redirect(
        new URL("/signup?error=unconfigured", publicOrigin(request.nextUrl.origin)),
      );
    }
    throw error;
  }
}
