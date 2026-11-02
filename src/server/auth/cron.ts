import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { errorResponse } from "./rbac";

/**
 * The cron routes are called by a scheduler, not a person, so they are
 * authenticated by a shared secret rather than a session. Unsecured, each
 * would be an endpoint any passer-by could use to burn a day's API quota —
 * which is also why an unset secret disables them instead of opening them.
 */
export function cronGate(request: NextRequest): Response | null {
  if (!process.env.CRON_SECRET?.trim()) {
    return errorResponse(
      "connector_unavailable",
      "CRON_SECRET is not set, so scheduled jobs are disabled.",
    );
  }
  if (!hasCronSecret(request)) {
    return errorResponse("unauthenticated", "Invalid cron credentials.");
  }
  return null;
}

/**
 * Whether the request carries the cron secret, as a question rather than a
 * gate.
 *
 * The ingestion routes accept *either* an operator session or this secret,
 * because both drive them: a person in the admin workspace, and the
 * unattended seed imports, which have no person to be. They used to sign in
 * as `admin@senso360.com` with `DEV_SEED_PASSWORD` — a variable that also
 * decides whether to create the seeded accounts at all, super_admin included,
 * on a password published in the README. So on production it is correctly
 * unset, and the imports had been failing on it since.
 *
 * An unset secret matches nothing, so this closes the door rather than
 * opening it.
 */
export function hasCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
