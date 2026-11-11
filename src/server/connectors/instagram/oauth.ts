import { z } from "zod";
import { ConnectorUnavailable } from "./instagram-connector";

/* ---------------------------------------------------------------------------
 * Instagram OAuth — the creator's own grant.
 *
 * The Business Discovery connector beside this file reads *as SENSO*, so what
 * it returns is public and a record built from it is `observed`, never
 * verified. This is the other half: a creator authorises their own
 * professional account, which proves who they are and unlocks the insights
 * Business Discovery cannot see.
 *
 * This is "Instagram API with Instagram Login", not the Basic Display API —
 * Meta shut that down in December 2024 — and not Facebook Login. That choice
 * follows from who the product is for: a creator signs in with the Instagram
 * account they actually post from, rather than hunting for the Facebook Page
 * it happens to be linked to. The token it mints is an `IGAA` token, which
 * the connector's `graphHost` already routes to graph.instagram.com.
 *
 * Two scopes and no more, mirroring the YouTube grant. `instagram_business_basic`
 * says which account consented; `instagram_business_manage_insights` reads the
 * figures. Neither can publish, reply or delete.
 *
 * Both are Advanced Access permissions, so they work for app admins, developers
 * and testers immediately and for everybody else only after Meta App Review —
 * which additionally requires Business Verification. Until that passes this
 * flow is real but reaches the SENSO team alone, which is the same position
 * the YouTube grant was in before its own verification.
 * ------------------------------------------------------------------------ */

const AUTH_ENDPOINT = "https://www.instagram.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
] as const;

export interface InstagramOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

/**
 * Null rather than throwing, so connector health can report without a catch.
 *
 * These are the *Instagram* app credentials, not the Facebook ones the
 * Business Discovery connector uses. A Meta app that has Instagram Login added
 * carries a second id and secret — "Instagram app ID" under Instagram → API
 * setup with Instagram login — and `instagram.com/oauth/authorize` accepts
 * only that one. Passing the Facebook `META_APP_ID` is answered with "Invalid
 * platform app", which names neither the parameter nor the fix, so they get
 * their own variables rather than a fallback that would reproduce it silently.
 */
export function instagramOAuthConfig(): InstagramOAuthConfig | null {
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();

  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri };
}

function requireConfig(): InstagramOAuthConfig {
  const config = instagramOAuthConfig();
  if (!config) {
    throw new ConnectorUnavailable(
      "instagram",
      "credentials_missing",
      "INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET and META_OAUTH_REDIRECT_URI must all be set to " +
        "connect an account. The first two are the Instagram app's own credentials, shown under " +
        "Instagram → API setup with Instagram login — not the Facebook app id and secret.",
    );
  }
  return config;
}

/**
 * Where to send the creator to consent.
 *
 * Meta wants the scopes comma separated here, where Google wants them space
 * separated — a difference worth stating in one place rather than discovering
 * it as an `invalid_scope` at the consent screen.
 */
export function instagramAuthorizationUrl(state: string): string {
  const config = requireConfig();
  const url = new URL(AUTH_ENDPOINT);

  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", state);

  return url.toString();
}

export interface InstagramTokens {
  accessToken: string;
  /**
   * The account the token belongs to, which Meta returns from the code
   * exchange itself. It is the identity check's input and is never taken
   * from anything the browser sent.
   */
  userId: string;
  expiresAt: string;
  scopes: string[];
}

const ShortLived = z.object({
  access_token: z.string(),
  user_id: z.union([z.string(), z.number()]),
  permissions: z.union([z.string(), z.array(z.string())]).optional(),
});

const LongLived = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

const GraphError = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
  }),
});

/** Meta's error envelope is nested where Google's is flat. */
function describe(payload: unknown, status: number): string {
  const parsed = GraphError.safeParse(payload);
  if (!parsed.success) return `HTTP ${status}`;
  const { message, code } = parsed.data.error;
  return code === undefined ? message : `${message} (code ${code})`;
}

/**
 * Exchanges the one-time code for a usable token.
 *
 * Two round trips, because Meta's code exchange returns a token that lasts an
 * hour. The second call trades it for the sixty-day one, and skipping that
 * step is how a connection appears to work and then dies the same afternoon.
 * Unlike Google there is no separate refresh token: the long-lived token
 * refreshes *itself* (see `refreshInstagramToken`), so `sealedRefreshToken`
 * stays null for this platform and the renewal path reads the access token.
 */
export async function exchangeInstagramCode(code: string): Promise<InstagramTokens> {
  const config = requireConfig();

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.appId,
        client_secret: config.appSecret,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
        code,
      }).toString(),
    });
  } catch (cause) {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      `Instagram token endpoint unreachable: ${String(cause)}`,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = describe(payload, response.status);
    // The redirect URI must match the app's "Valid OAuth Redirect URIs" list
    // character for character, trailing slash included. It is the first-run
    // failure here just as it is on Google.
    throw new ConnectorUnavailable(
      "instagram",
      /redirect/i.test(detail) ? "credentials_missing" : "forbidden",
      `Instagram refused the token exchange: ${detail}`,
    );
  }

  const parsed = ShortLived.safeParse(payload);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      "Instagram returned an unexpected token response.",
    );
  }

  const granted = Array.isArray(parsed.data.permissions)
    ? parsed.data.permissions
    : (parsed.data.permissions?.split(",").map((scope) => scope.trim()) ?? [...INSTAGRAM_SCOPES]);

  const long = await exchangeForLongLived(parsed.data.access_token, config);

  return {
    accessToken: long.accessToken,
    userId: String(parsed.data.user_id),
    expiresAt: long.expiresAt,
    scopes: granted.filter(Boolean),
  };
}

async function exchangeForLongLived(
  shortLived: string,
  config: InstagramOAuthConfig,
): Promise<{ accessToken: string; expiresAt: string }> {
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("access_token", shortLived);

  const response = await fetch(url, { cache: "no-store" }).catch((cause: unknown) => {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      `Instagram graph unreachable: ${String(cause)}`,
    );
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ConnectorUnavailable(
      "instagram",
      "forbidden",
      `Instagram refused the long-lived exchange: ${describe(payload, response.status)}`,
    );
  }

  const parsed = LongLived.safeParse(payload);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      "Instagram returned an unexpected long-lived token response.",
    );
  }

  return {
    accessToken: parsed.data.access_token,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString(),
  };
}

/**
 * Renews a long-lived token before it lapses.
 *
 * Meta refuses a token younger than 24 hours and one already expired, so this
 * is called on a window rather than on expiry. A failure means the creator
 * revoked access — a `needsReauth` state, not an error to retry.
 */
export async function refreshInstagramToken(
  accessToken: string,
): Promise<{ accessToken: string; expiresAt: string }> {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" }).catch((cause: unknown) => {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      `Instagram graph unreachable: ${String(cause)}`,
    );
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ConnectorUnavailable(
      "instagram",
      "forbidden",
      `Instagram refused the token refresh: ${describe(payload, response.status)}`,
    );
  }

  const parsed = LongLived.safeParse(payload);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      "Instagram returned an unexpected refresh response.",
    );
  }

  return {
    accessToken: parsed.data.access_token,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString(),
  };
}

const Me = z.object({
  user_id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  username: z.string(),
});

/**
 * Reads the account the token's owner controls.
 *
 * The YouTube equivalent of this is `channels.list?mine=true`, and it exists
 * for the same reason: the connection is refused unless the consenting account
 * is the one on the profile being claimed. `exchangeInstagramCode` already
 * returns the user id, so this call is for the handle — which is what the
 * creator recognises, and what a mismatch has to name to be worth reading.
 */
export async function fetchOwnInstagramAccount(
  accessToken: string,
): Promise<{ userId: string; username: string } | null> {
  const url = new URL(`${GRAPH}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    // A missing permission, a revoked grant and a personal account that cannot
    // be read at all all arrive here, and the creator seeing the notice can
    // diagnose none of them. Meta's envelope names the reason and never
    // carries the token.
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error(`[instagram-connect] HTTP ${response.status} from /me: ${detail}`);

    throw new ConnectorUnavailable(
      "instagram",
      response.status === 401 || response.status === 403 ? "forbidden" : "upstream_error",
      `Could not read the connected Instagram account (HTTP ${response.status}).`,
    );
  }

  const parsed = Me.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return null;

  const id = parsed.data.user_id ?? parsed.data.id;
  return id === undefined ? null : { userId: String(id), username: parsed.data.username };
}
