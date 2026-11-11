import { ConnectorUnavailable } from "@/server/connectors/youtube";
import { fetchChannelAnalytics, type ChannelAnalytics } from "@/server/connectors/youtube/analytics";
import { readRecords } from "@/server/data/records";
import { requirePermission } from "@/server/auth/rbac";
import { accessTokenFor } from "@/server/services/connection-service";
import { ConnectorUnavailable as InstagramUnavailable } from "@/server/connectors/instagram";
import { fetchInstagramInsights, type InstagramInsights } from "@/server/connectors/instagram/insights";
import { instagramAccessTokenFor } from "@/server/services/instagram-connection-service";

/* ---------------------------------------------------------------------------
 * Authorized Data, and the one rule that separates it from everything else
 * this product holds.
 *
 * Every other figure in SENSO is public API data: anyone may see it, and the
 * whole index is built on that. The numbers here are not. YouTube's developer
 * policy is explicit — "API Clients must not display or allow access to
 * Authorized Data to anyone other than the authorizing user or agents
 * expressly approved by that user" — so a creator's own analytics may never
 * appear on a brand-facing surface, in search, in a comparison, in an export,
 * or in the public API.
 *
 * That boundary is enforced here rather than written down and hoped for. The
 * function resolves the creator from the session and refuses to read a
 * channel the caller does not own, so there is no argument a client-side
 * caller could pass to reach somebody else's figures, and no way to reuse
 * this service from a brand surface by mistake: a client session fails the
 * permission check before any token is touched.
 *
 * The result is deliberately not cached or persisted. Storing it would make a
 * copy of Authorized Data that outlives the consent, and the retention and
 * revocation rules that then apply (delete within 7 days of an in-app
 * revocation, re-check authorisation every 30 days) are a liability taken on
 * for no gain while this is a page a creator looks at.
 * ------------------------------------------------------------------------ */

export type CreatorAnalytics =
  | { state: "ok"; data: ChannelAnalytics }
  | { state: "not_connected" }
  | { state: "needs_reauth" }
  | { state: "unavailable"; reason: string };

export async function creatorAnalytics(days = 28): Promise<CreatorAnalytics> {
  // `self:analytics_read` belongs to the influencer role only, so a client or
  // an admin session cannot reach this at all.
  const user = await requirePermission("self:analytics_read");
  if (!user.influencerId) return { state: "not_connected" };

  const account = readRecords().accounts.find(
    (item) => item.influencerId === user.influencerId && item.isPrimary,
  );
  if (!account || !account.isConnected) return { state: "not_connected" };

  const token = await accessTokenFor(account.id);
  if (!token) return { state: "needs_reauth" };

  try {
    return { state: "ok", data: await fetchChannelAnalytics(token, days) };
  } catch (error) {
    if (error instanceof ConnectorUnavailable) {
      return {
        state: error.reason === "forbidden" ? "needs_reauth" : "unavailable",
        reason: error.message,
      } as CreatorAnalytics;
    }
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * The same boundary, on the other platform.
 *
 * Instagram's grant is held against the creator's Instagram account row
 * rather than their primary one — most creators here were indexed from
 * YouTube — so the lookup differs, and nothing else does. The permission
 * check, the refusal to take an account id from input, and the rule against
 * storing what comes back are identical, and deliberately so: two copies of
 * an access rule that drift are worse than one rule applied twice.
 * ------------------------------------------------------------------------ */

export type InstagramCreatorAnalytics =
  | { state: "ok"; data: InstagramInsights }
  | { state: "not_connected" }
  | { state: "needs_reauth" }
  | { state: "unavailable"; reason: string };

export async function instagramCreatorAnalytics(days = 28): Promise<InstagramCreatorAnalytics> {
  const user = await requirePermission("self:analytics_read");
  if (!user.influencerId) return { state: "not_connected" };

  const account = readRecords().accounts.find(
    (item) => item.influencerId === user.influencerId && item.platform === "instagram",
  );
  if (!account || !account.isConnected) return { state: "not_connected" };

  const token = await instagramAccessTokenFor(account.id);
  if (!token) return { state: "needs_reauth" };

  try {
    return { state: "ok", data: await fetchInstagramInsights(token, days) };
  } catch (error) {
    if (error instanceof InstagramUnavailable) {
      return {
        state: error.reason === "forbidden" ? "needs_reauth" : "unavailable",
        reason: error.message,
      } as InstagramCreatorAnalytics;
    }
    throw error;
  }
}
