import { sealToken, openToken, tokenCryptoConfigured } from "@/server/auth/token-crypto";
import {
  exchangeInstagramCode,
  fetchOwnInstagramAccount,
  instagramAuthorizationUrl,
  instagramOAuthConfig,
  refreshInstagramToken,
  type InstagramTokens,
} from "@/server/connectors/instagram/oauth";
import { readRecords, type RawOAuthGrant } from "@/server/data/records";
import { removeGrant, upsertGrant, upsertIngested } from "@/server/data/ingested-store";
import { ConnectionRefused, issueState, verifyState } from "@/server/services/connection-service";

/* ---------------------------------------------------------------------------
 * Connecting a creator's own Instagram account.
 *
 * The shape follows `connection-service`, and the state helpers are imported
 * from it rather than copied: the signature, the TTL and the replay rules are
 * one implementation or they drift, and a second copy of a security primitive
 * is how one of them quietly stops being checked.
 *
 * Two things differ from YouTube, and both come from a creator being able to
 * hold more than one account.
 *
 * The grant attaches to the creator's *Instagram* account row, not their
 * primary one, which on most records is YouTube. And disconnecting Instagram
 * must not withdraw a YouTube verification, so the creator-level flags are
 * recomputed from whatever accounts remain connected rather than set to the
 * outcome of this one change.
 * ------------------------------------------------------------------------ */

export function instagramConnectionConfigured(): boolean {
  return instagramOAuthConfig() !== null && tokenCryptoConfigured();
}

/** Namespaced so an Instagram state can never be replayed as a YouTube one. */
function instagramState(influencerId: string): string {
  return `ig:${issueState(influencerId)}`;
}

export function verifyInstagramState(state: string): { influencerId: string } | null {
  if (!state.startsWith("ig:")) return null;
  return verifyState(state.slice(3));
}

export function startInstagramConnection(influencerId: string): string {
  return instagramAuthorizationUrl(instagramState(influencerId));
}

export interface InstagramConnectionResult {
  influencerId: string;
  username: string;
  identityMatched: boolean;
}

/**
 * Completes the round trip and confirms *which* account consented.
 *
 * The id comes from the token exchange, so it describes the account whose
 * token we hold and not whatever a browser sent back. A creator consenting
 * from an account that is not the one on this profile has proved they control
 * that other account — which is a reason to refuse, not to attach.
 */
export async function completeInstagramConnection(
  code: string,
  state: string,
): Promise<InstagramConnectionResult> {
  const verified = verifyInstagramState(state);
  if (!verified) {
    throw new ConnectionRefused(
      "state_invalid",
      "This connection link is invalid or has expired. Start the connection again.",
    );
  }

  const tokens = await exchangeInstagramCode(code);

  // The handle is what a creator recognises, so a mismatch can name it.
  const owned = await fetchOwnInstagramAccount(tokens.accessToken);
  if (!owned) {
    throw new ConnectionRefused(
      "no_channel",
      "That Instagram account could not be read. It must be a Business or Creator account.",
    );
  }

  const account = readRecords().accounts.find(
    (item) => item.influencerId === verified.influencerId && item.platform === "instagram",
  );
  if (!account) {
    throw new ConnectionRefused("no_channel", "No tracked Instagram account for this creator.");
  }

  if (account.platformAccountId !== owned.userId) {
    throw new ConnectionRefused(
      "identity_mismatch",
      `That account owns @${owned.username}, which is not the Instagram account on this profile. ` +
        `Sign in with the account that owns it.`,
    );
  }

  await storeInstagramGrant(verified.influencerId, account.id, owned, tokens);

  return {
    influencerId: verified.influencerId,
    username: owned.username,
    // Matched by construction: the grant is refused above otherwise.
    identityMatched: true,
  };
}

async function storeInstagramGrant(
  influencerId: string,
  accountId: string,
  owned: { userId: string; username: string },
  tokens: InstagramTokens,
): Promise<void> {
  const grant: RawOAuthGrant = {
    accountId,
    influencerId,
    platform: "instagram",
    platformAccountId: owned.userId,
    sealedAccessToken: sealToken(tokens.accessToken),
    // Instagram has no separate refresh token — the long-lived token renews
    // itself, so the renewal path reads the access token instead.
    sealedRefreshToken: null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    grantedAt: new Date().toISOString(),
    needsReauth: false,
  };

  await upsertGrant(grant);
  await markInstagramConnected(influencerId, accountId, true);
}

/**
 * Flips the Instagram account, then recomputes the creator's own flags.
 *
 * `isConnected` on the creator means "at least one account is connected", so
 * it is derived from the accounts after this change rather than assigned from
 * it. Writing `false` here on an Instagram disconnect would silently strip the
 * verified badge off a creator whose YouTube grant is still live.
 */
async function markInstagramConnected(
  influencerId: string,
  accountId: string,
  connected: boolean,
): Promise<void> {
  const data = readRecords();
  const influencer = data.influencers.find((item) => item.id === influencerId);
  const accounts = data.accounts.filter((item) => item.influencerId === influencerId);
  const content = data.content.filter((item) => item.influencerId === influencerId);
  const primary = accounts.find((item) => item.isPrimary);
  const snapshot = primary ? data.snapshots.find((item) => item.accountId === primary.id) : null;
  if (!influencer || accounts.length === 0 || !snapshot) return;

  const updated = accounts.map((item) =>
    item.id === accountId
      ? {
          ...item,
          isConnected: connected,
          connectedAt: connected ? new Date().toISOString() : null,
          needsReauth: false,
        }
      : item,
  );
  const anyConnected = updated.some((item) => item.isConnected);

  await upsertIngested([
    {
      influencer: {
        ...influencer,
        isConnected: anyConnected,
        identityMatched: anyConnected,
      },
      accounts: updated,
      snapshot,
      content,
    },
  ]);
}

export async function disconnectInstagram(influencerId: string, accountId: string): Promise<void> {
  await removeGrant(accountId);
  await markInstagramConnected(influencerId, accountId, false);
}

/**
 * A usable token for an Instagram account, renewed when it is near expiry.
 *
 * Meta refuses to refresh a token that has already lapsed, so the window is
 * days rather than the minute of headroom the Google path uses: a token
 * renewed a week early costs one call, and one renewed an hour late cannot be
 * renewed at all and puts the creator through consent again.
 */
const RENEW_WITHIN_MS = 7 * 86_400_000;

export async function instagramAccessTokenFor(accountId: string): Promise<string | null> {
  const grant = readRecords().grants.get(accountId);
  if (!grant || grant.platform !== "instagram" || grant.needsReauth) return null;

  const token = openToken(grant.sealedAccessToken);
  if (new Date(grant.expiresAt).getTime() - RENEW_WITHIN_MS > Date.now()) return token;

  try {
    const renewed = await refreshInstagramToken(token);
    await upsertGrant({
      ...grant,
      sealedAccessToken: sealToken(renewed.accessToken),
      expiresAt: renewed.expiresAt,
      needsReauth: false,
    });
    return renewed.accessToken;
  } catch {
    // Revocation is the usual cause. Record it so the creator is asked to
    // reconnect rather than the platform retrying a dead credential forever.
    await upsertGrant({ ...grant, needsReauth: true });
    return null;
  }
}
