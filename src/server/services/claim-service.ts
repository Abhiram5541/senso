import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { authorizationUrl, exchangeCode } from "@/server/connectors/youtube/oauth";
import { readRecords } from "@/server/data/records";
import { linkInfluencer, listUsers } from "@/server/repositories/user-repository";
import { IngestionRefused, ingestYouTubeChannel } from "@/server/services/ingestion-service";
import { completeConnectionFor, fetchOwnChannel } from "@/server/services/connection-service";

/* ---------------------------------------------------------------------------
 * Claiming a creator record.
 *
 * `connection-service` connects a channel to a record the creator already
 * owns — it starts from an `influencerId` and refuses any Google account that
 * does not own that exact channel. That is correct, and it is useless to
 * somebody who has just signed up: they have no `influencerId` yet, which is
 * precisely the thing they are trying to obtain.
 *
 * So this is the inverse. It starts from a *user* and lets the consenting
 * Google account decide which record they get:
 *
 *   1. the account consents, and YouTube says which channel it owns;
 *   2. if SENSO already indexed that channel, that record is theirs;
 *   3. if not, the channel is ingested now and the new record is theirs.
 *
 * Step 3 is the growth path the product was missing. A creator who adds
 * themselves arrives through their own authorised grant, which is source
 * tier 2 — above the tier-1 public read the harvest performs — and it costs
 * about two quota units rather than the hundred a `search.list` discovery
 * costs, because nothing is being searched for. The creator knows exactly
 * which channel is theirs; we never have to guess.
 *
 * The direction of trust never reverses: the channel is still whatever Google
 * says the consenting account owns. Nothing the person typed is believed.
 * ------------------------------------------------------------------------ */

const STATE_TTL_MS = 10 * 60_000;

export class ClaimRefused extends Error {
  constructor(
    readonly code: "state_invalid" | "no_channel" | "already_claimed" | "ingest_failed",
    message: string,
  ) {
    super(message);
    this.name = "ClaimRefused";
  }
}

function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "development-only-session-key-do-not-ship-32";
}

/**
 * State carrying the user id, prefixed so it can never be mistaken for a
 * `connection-service` state — the two are signed with the same secret and
 * arrive at different callbacks, and a value accepted by both would let a
 * claim be replayed as a connection.
 */
export function issueClaimState(userId: string): string {
  const payload = `claim:${userId}:${Date.now()}:${randomBytes(8).toString("base64url")}`;
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyClaimState(state: string): { userId: string } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  const [kind, userId, issuedAt] = payload.split(":");
  if (kind !== "claim" || !userId) return null;
  if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

  return { userId };
}

export function startClaim(userId: string): string {
  return authorizationUrl(issueClaimState(userId));
}

export interface ClaimResult {
  influencerId: string;
  channelTitle: string;
  /** True when SENSO had never seen this channel and ingested it just now. */
  indexed: boolean;
}

/** The influencer record whose primary account is this channel, if any. */
function recordForChannel(channelId: string): string | null {
  const data = readRecords();
  const account = data.accounts.find(
    (item) => item.platform === "youtube" && item.platformAccountId === channelId,
  );
  return account?.influencerId ?? null;
}

export async function completeClaim(code: string, state: string): Promise<ClaimResult> {
  const verified = verifyClaimState(state);
  if (!verified) {
    throw new ClaimRefused(
      "state_invalid",
      "This link is invalid or has expired. Start the connection again.",
    );
  }

  const tokens = await exchangeCode(code);

  const owned = await fetchOwnChannel(tokens.accessToken);
  if (!owned) {
    throw new ClaimRefused(
      "no_channel",
      "That Google account does not own a YouTube channel. Sign in with the account that manages your channel.",
    );
  }

  let influencerId = recordForChannel(owned.channelId);
  let indexed = false;

  if (influencerId) {
    // One record, one owner. Without this a second person consenting from a
    // manager account on the same channel would silently take the profile
    // over, and the first creator would lose their own analytics.
    const taken = (await listUsers()).find(
      (user) => user.influencerId === influencerId && user.id !== verified.userId,
    );
    if (taken) {
      throw new ClaimRefused(
        "already_claimed",
        "This channel has already been claimed on SENSO. Contact support if that is not you.",
      );
    }
  } else {
    // Not indexed yet — add it from the creator's own authorised account.
    try {
      const report = await ingestYouTubeChannel(owned.channelId);
      influencerId = report.influencerId;
      indexed = true;
    } catch (error) {
      if (error instanceof IngestionRefused) {
        throw new ClaimRefused("ingest_failed", error.message);
      }
      throw error;
    }
  }

  // Store the grant and mark the account connected, exactly as an ordinary
  // connection would — the claim and the connection are the same act here.
  await completeConnectionFor(influencerId, owned, tokens);
  await linkInfluencer(verified.userId, influencerId);

  return { influencerId, channelTitle: owned.title, indexed };
}
