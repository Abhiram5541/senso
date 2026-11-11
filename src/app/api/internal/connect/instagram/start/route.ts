import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/instagram";
import {
  instagramConnectionConfigured,
  startInstagramConnection,
} from "@/server/services/instagram-connection-service";

/**
 * Sends the signed-in creator to Instagram's consent screen.
 *
 * `self:connections_write`, and the influencer id comes from the session
 * rather than the request: a creator may connect their own account and no
 * one else's, and taking the id from input would make that a matter of what
 * someone typed.
 */
export async function GET() {
  return handler(async () => {
    const user = await requirePermission("self:connections_write");
    if (!user.influencerId) {
      throw new ApiFailure("not_found", "This account is not linked to a creator profile.");
    }

    if (!instagramConnectionConfigured()) {
      throw new ApiFailure(
        "connector_unavailable",
        "Instagram connection is not configured. INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, " +
          "META_OAUTH_REDIRECT_URI and TOKEN_ENCRYPTION_KEY must all be set. The first two are " +
          "the Instagram app's own credentials, not the Facebook app id and secret.",
      );
    }

    try {
      return NextResponse.redirect(startInstagramConnection(user.influencerId));
    } catch (error) {
      if (error instanceof ConnectorUnavailable) {
        throw new ApiFailure("connector_unavailable", error.message, { reason: error.reason });
      }
      throw error;
    }
  });
}
