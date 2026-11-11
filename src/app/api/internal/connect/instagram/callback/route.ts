import { NextResponse, type NextRequest } from "next/server";
import { ConnectorUnavailable } from "@/server/connectors/instagram";
import { ConnectionRefused } from "@/server/services/connection-service";
import { completeInstagramConnection } from "@/server/services/instagram-connection-service";
import { publicOrigin } from "@/server/services/google-auth-service";

/**
 * Where Instagram sends the creator back.
 *
 * Always a redirect to the connections page carrying a readable outcome,
 * never a JSON body: a person is looking at this, having just left a consent
 * screen. The one-time code is exchanged server-side and never reaches the
 * browser.
 *
 * Instagram has its own redirect URI registered on the Meta app, so unlike
 * the YouTube callback this one carries a single flow and needs no prefix
 * test to tell two apart. The `ig:` state prefix is still checked, because a
 * state minted for YouTube must not complete here.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (status: string, detail?: string) => {
    const url = new URL("/creator/connections", publicOrigin(request.nextUrl.origin));
    url.searchParams.set("connection", status);
    if (detail) url.searchParams.set("detail", detail);
    return NextResponse.redirect(url);
  };

  // The creator pressed Cancel, or Meta refused outright. Meta spells the
  // denial differently from Google and sends a readable reason beside it.
  const denied = params.get("error");
  if (denied) {
    const reason = params.get("error_description") ?? denied;
    const cancelled = denied === "access_denied" || params.get("error_reason") === "user_denied";
    return back(cancelled ? "cancelled" : "failed", reason);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back("failed", "Instagram did not return an authorisation code.");

  try {
    const result = await completeInstagramConnection(code, state);
    return back("connected", `@${result.username}`);
  } catch (error) {
    if (error instanceof ConnectionRefused || error instanceof ConnectorUnavailable) {
      return back("failed", error.message);
    }
    // Nothing internal escapes to a URL a creator can read or share.
    console.error("[connect-instagram] unhandled error", error);
    return back("failed", "Something went wrong completing the connection.");
  }
}
