import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { readRecords } from "@/server/data/records";
import { disconnectInstagram } from "@/server/services/instagram-connection-service";

/**
 * Revokes a creator's Instagram grant on this side.
 *
 * The creator id comes from the session, so this can only ever disconnect the
 * caller's own account. Their public profile is untouched — Business
 * Discovery keeps it current — and a YouTube connection on the same creator
 * is left alone, which is why this does not reuse the primary-account path.
 */
export async function POST() {
  return handler(async () => {
    const user = await requirePermission("self:connections_write");
    if (!user.influencerId) {
      throw new ApiFailure("not_found", "This account is not linked to a creator profile.");
    }

    const account = readRecords().accounts.find(
      (item) => item.influencerId === user.influencerId && item.platform === "instagram",
    );
    if (!account) {
      throw new ApiFailure("not_found", "No tracked Instagram account for this creator.");
    }

    await disconnectInstagram(user.influencerId, account.id);
    return NextResponse.json({ disconnected: true });
  });
}
