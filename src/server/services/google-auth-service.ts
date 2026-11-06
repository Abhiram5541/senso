import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/contracts/auth";

/* ---------------------------------------------------------------------------
 * Sign in with Google — the front door for people who are not invited.
 *
 * Until now every account was created by a super admin and the public form was
 * an enquiry (D41). That is right for a client whose contract is negotiated and
 * wrong for a creator, who has no reason to wait a business day to look at
 * their own numbers, and whose self-service arrival is the product's cheapest
 * growth path.
 *
 * Why Google rather than a password. Identity here has to be worth something:
 * a creator account can read authorised analytics for a creator record, so
 * "who are you" cannot be a self-asserted email. Google answers it, carries
 * its own verified-email signal, and is the same provider the YouTube grant
 * already uses — so a creator consents once to a vendor they already have a
 * relationship with. No password is stored, so none can leak or be reused.
 *
 * What this file does NOT do, deliberately: signing in with Google proves the
 * person controls a Google account. It does not prove they own a YouTube
 * channel, and it says nothing at all about an Instagram handle. Claiming a
 * creator record is a separate step with its own proof, in
 * `connection-service`. Conflating the two is how somebody signs in with a
 * throwaway Gmail and claims MrBeast.
 * ------------------------------------------------------------------------ */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** Long enough to read a consent screen, short enough that a leaked state is
 *  useless by the time anyone finds it. */
const STATE_TTL_MS = 10 * 60_000;

/** Identity only. The YouTube read scope is requested later, at the claim. */
const SCOPES = ["openid", "email", "profile"];

export class GoogleAuthUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthUnavailable";
  }
}

export class GoogleAuthRefused extends Error {
  constructor(
    readonly code: "state_invalid" | "no_email" | "email_unverified" | "exchange_failed",
    message: string,
  ) {
    super(message);
    this.name = "GoogleAuthRefused";
  }
}

/**
 * The same Google client the YouTube connection uses.
 *
 * Reused rather than duplicated: it is one OAuth client in one Google project,
 * and a second set of credentials would be a second thing to rotate and a
 * second consent screen for the same company.
 */
function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleAuthUnavailable(
      "Google sign-in is not configured: YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET must be set.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * The origin Google must be told to come back to.
 *
 * `APP_URL` first, and the request's own origin only as a fallback. Behind a
 * reverse proxy the Node process sees the address it is actually bound to —
 * in production that is `https://localhost:3005`, because nginx terminates
 * TLS and forwards to the port. Deriving the redirect from the request sent
 * Google a localhost callback it would never accept, and the failure is not
 * visible locally, where the two happen to be the same thing.
 *
 * Both the authorization request and the token exchange call this, so they
 * cannot disagree: Google rejects an exchange whose redirect_uri differs by
 * so much as a trailing slash from the one the code was issued for.
 */
export function publicOrigin(requestOrigin: string): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return configured || requestOrigin;
}

/** Must match a redirect URI registered on the Google client, exactly. */
export function redirectUri(origin: string): string {
  return `${publicOrigin(origin)}/api/internal/auth/google/callback`;
}

function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "development-only-session-key-do-not-ship-32";
}

/**
 * The signed state.
 *
 * It carries the intent the person chose before leaving — creator or brand —
 * because Google will not tell us, and asking again on the way back would let
 * somebody answer differently from the person who started. Signed with the
 * session secret so a value this server did not issue cannot pass, and
 * timestamped so a captured one expires.
 */
export function issueState(intent: "creator" | "brand", returnTo: string): string {
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "";
  const payload = [
    intent,
    Date.now(),
    randomBytes(8).toString("base64url"),
    Buffer.from(safeReturn).toString("base64url"),
  ].join(":");
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyState(
  state: string,
): { intent: "creator" | "brand"; returnTo: string } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  const [intent, issuedAt, , encodedReturn = ""] = payload.split(":");
  if (intent !== "creator" && intent !== "brand") return null;
  if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

  return {
    intent,
    returnTo: Buffer.from(encodedReturn, "base64url").toString("utf8"),
  };
}

export function authorizationUrl(origin: string, state: string): string {
  const { clientId } = credentials();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Always show the chooser: a shared machine whose browser is signed into one
  // Google account would otherwise create the wrong SENSO account silently.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export interface GoogleIdentity {
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Exchanges the one-time code for the person's Google identity.
 *
 * The access token is used once, here, and never stored: this is an identity
 * check, not a data connection, so keeping the token would be holding a
 * credential for no purpose.
 */
export async function exchangeCode(code: string, origin: string): Promise<GoogleIdentity> {
  const { clientId, clientSecret } = credentials();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    // Google's body can quote part of the client secret back. Log it in full,
    // report it in outline (D47).
    console.error("[google-auth] token exchange failed", tokenResponse.status, await tokenResponse.text());
    throw new GoogleAuthRefused("exchange_failed", "Google did not accept the sign-in. Try again.");
  }

  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) {
    throw new GoogleAuthRefused("exchange_failed", "Google returned no access token.");
  }

  const infoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!infoResponse.ok) {
    console.error("[google-auth] userinfo failed", infoResponse.status);
    throw new GoogleAuthRefused("exchange_failed", "Google would not return the account details.");
  }

  const info = (await infoResponse.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!info.email) {
    throw new GoogleAuthRefused("no_email", "That Google account has no email address.");
  }
  // An unverified Google email is an email somebody typed, not one they own,
  // and the whole point of using Google here is that it has already checked.
  if (info.email_verified === false) {
    throw new GoogleAuthRefused(
      "email_unverified",
      "Verify your email address with Google first, then sign in again.",
    );
  }

  return {
    email: info.email.trim().toLowerCase(),
    name: info.name?.trim() || info.email.split("@")[0],
    avatarUrl: info.picture ?? null,
  };
}

/** The role a chosen intent maps to. A brand's first user owns their org. */
export function roleFor(intent: "creator" | "brand"): Role {
  return intent === "creator" ? "influencer" : "client_owner";
}
