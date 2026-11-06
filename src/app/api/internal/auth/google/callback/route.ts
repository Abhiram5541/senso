import { NextResponse, type NextRequest } from "next/server";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { setSessionCookie } from "@/server/auth/session";
import { findOrCreateGoogleUser, toSessionUser } from "@/server/repositories/user-repository";
import {
  GoogleAuthRefused,
  GoogleAuthUnavailable,
  exchangeCode,
  publicOrigin,
  roleFor,
  verifyState,
} from "@/server/services/google-auth-service";

/**
 * Where Google sends the visitor back.
 *
 * Always a redirect, never a JSON body: a person is looking at this, having
 * just left a consent screen. The one-time code is exchanged server-side and
 * never reaches the browser.
 *
 * A creator lands in the portal's connection step rather than its dashboard,
 * because an account with no claimed record has nothing to show yet and the
 * claim is the thing that makes the account worth having.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Behind nginx the request's own origin is https://localhost:3005.
  const origin = publicOrigin(request.nextUrl.origin);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent(reason)}`, origin));

  const denied = params.get("error");
  if (denied) {
    return NextResponse.redirect(
      new URL(denied === "access_denied" ? "/signup?error=cancelled" : "/signup?error=failed", origin),
    );
  }

  const code = params.get("code");
  const rawState = params.get("state");
  if (!code || !rawState) return fail("failed");

  const state = verifyState(rawState);
  if (!state) return fail("state_invalid");

  try {
    const identity = await exchangeCode(code, origin);
    const role = roleFor(state.intent);

    const { user, org, created } = await findOrCreateGoogleUser({
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.avatarUrl,
      role,
      orgName: identity.name,
    });

    await setSessionCookie(toSessionUser(user, org));

    // Where they land is decided by the account they actually have, not by
    // the door they came through: somebody with a client account who clicks
    // the creator button must not be dropped into a creator portal they have
    // no record for.
    if (state.returnTo) {
      return NextResponse.redirect(new URL(state.returnTo, origin));
    }
    if (user.role === "influencer" && !user.influencerId) {
      return NextResponse.redirect(new URL("/creator/claim", origin));
    }
    return NextResponse.redirect(
      new URL(
        `${WORKSPACE_HOME[ROLE_WORKSPACE[user.role]]}${created ? "?welcome=1" : ""}`,
        origin,
      ),
    );
  } catch (error) {
    if (error instanceof GoogleAuthRefused) return fail(error.code);
    if (error instanceof GoogleAuthUnavailable) return fail("unconfigured");
    // A suspended account, a missing org — real messages, but not ones to put
    // in a URL the person can share.
    console.error("[google-auth] callback failed", error);
    return fail("failed");
  }
}
