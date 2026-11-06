import { NextResponse, type NextRequest } from "next/server";
import { requirePageSession } from "@/server/auth/rbac";
import { startClaim } from "@/server/services/claim-service";
import { connectionConfigured } from "@/server/services/connection-service";

/**
 * Starts the claim for a signed-in creator who owns no record yet.
 *
 * Distinct from `/api/internal/connect/youtube/start`, which requires an
 * `influencerId` on the session and refuses without one — exactly the state
 * a creator is in the moment they finish signing up. Here the consenting
 * channel is what decides the record, so no id is needed going in.
 *
 * The session is the only input. A user id in the query would let anyone
 * start a claim that attaches a channel to somebody else's account.
 *
 * Google returns to the shared connect callback, which dispatches on the
 * state's `claim:` prefix.
 */
export async function GET(request: NextRequest) {
  const user = await requirePageSession("/creator/claim");

  const back = (status: string) =>
    NextResponse.redirect(
      new URL(`/creator/claim?connection=${status}`, request.nextUrl.origin),
    );

  if (user.role !== "influencer") return back("not_creator");
  if (user.influencerId) return back("already_linked");
  if (!connectionConfigured()) return back("unconfigured");

  return NextResponse.redirect(startClaim(user.id));
}
