import { NextResponse, type NextRequest } from "next/server";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import { getSession, setSessionCookie } from "@/server/auth/session";
import { findOrg, findUserByEmail, toSessionUser } from "@/server/repositories/user-repository";
import { ClaimRefused, completeClaim, verifyClaimState } from "@/server/services/claim-service";
import { ConnectionRefused, completeConnection } from "@/server/services/connection-service";

/**
 * Where Google sends the creator back.
 *
 * Always a redirect to the connections page carrying a readable outcome, never
 * a JSON body: a person is looking at this, having just left a consent screen.
 * The one-time code is exchanged server-side and never reaches the browser.
 *
 * Two flows land here, and the state says which. A *connection* starts from a
 * record the creator already owns and refuses any account that does not own
 * that exact channel. A *claim* starts from a creator who owns no record yet,
 * and lets the consenting channel decide which record they get — indexing it
 * first if SENSO has never seen it.
 *
 * They share this one callback deliberately: Google validates the redirect URI
 * against the list registered on the OAuth client, so a second entry point
 * would mean a console change on every deployment. The claim state carries a
 * `claim:` prefix under the same signature, so the two can never be confused
 * for one another and a claim cannot be replayed as a connection.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (status: string, detail?: string) => {
    const url = new URL("/creator/connections", request.nextUrl.origin);
    url.searchParams.set("connection", status);
    if (detail) url.searchParams.set("detail", detail);
    return NextResponse.redirect(url);
  };

  // The creator pressed Cancel, or Google refused outright.
  const denied = params.get("error");
  if (denied) {
    return back(denied === "access_denied" ? "cancelled" : "failed", denied);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back("failed", "Google did not return an authorisation code.");

  if (verifyClaimState(state)) return claim(code, state, back);

  try {
    const result = await completeConnection(code, state);
    return back("connected", result.channelTitle);
  } catch (error) {
    if (error instanceof ConnectionRefused || error instanceof ConnectorUnavailable) {
      return back("failed", error.message);
    }
    // Nothing internal escapes to a URL a creator can read or share.
    console.error("[connect] unhandled error", error);
    return back("failed", "Something went wrong completing the connection.");
  }
}

async function claim(
  code: string,
  state: string,
  back: (status: string, detail?: string) => NextResponse,
): Promise<NextResponse> {
  try {
    const result = await completeClaim(code, state);

    // The session is signed at sign-in and carries `influencerId`, which was
    // null a moment ago. Without a fresh cookie the creator would hold a
    // week-old token saying they own nothing, and every portal page would
    // 404 on them until it expired.
    const session = await getSession();
    if (session) {
      const user = await findUserByEmail(session.email);
      const org = user ? await findOrg(user.orgId) : null;
      if (user && org) await setSessionCookie(toSessionUser(user, org));
    }

    return back(result.indexed ? "indexed" : "claimed", result.channelTitle);
  } catch (error) {
    if (error instanceof ClaimRefused) return back(error.code, error.message);
    if (error instanceof ConnectorUnavailable) return back("failed", error.message);
    console.error("[claim] unhandled error", error);
    return back("failed", "Something went wrong completing the connection.");
  }
}
