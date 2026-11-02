import { readFileSync } from "node:fs";

/*
 * Sweeps YouTube for creators working out of Hyderabad, Bengaluru and
 * Rajahmundry, one search per request so a quota that runs out on the
 * thirtieth search keeps the twenty-nine already paid for and the log says
 * where to resume.
 *
 * The queries themselves live in src/server/services/discovery-plan.ts — the
 * same list the daily scheduler rotates through — so this and the scheduler
 * cannot disagree about what "the places" are.
 *
 * Usage: node scripts/harvest-places.mjs [--top] [--from N]
 *   --top   the view-count-ranked plan: the biggest channels that keep making
 *           content about the place. A second pass, not a first.
 * Needs the dev server on APP_URL and CRON_SECRET in .env.local.
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);
const APP_URL = env.APP_URL ?? "http://localhost:3000";
const plan = process.argv.includes("--top") ? "top" : "places";

/*
 * Unattended, so it authenticates as a scheduler rather than as a person:
 * the ingestion routes take the cron secret as an alternative to an operator
 * session. This used to sign in as admin@senso360.com with
 * DEV_SEED_PASSWORD, which is the variable that also decides whether to
 * create the seeded accounts at all — correctly unset in production, so every
 * run died on `422 password: expected string, received undefined`.
 */
const CRON_SECRET = (process.env.CRON_SECRET ?? env.CRON_SECRET ?? "").trim();
if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set in .env.local; the ingestion routes will refuse this run.");
  process.exit(1);
}
const authHeaders = {
  "content-type": "application/json",
  authorization: `Bearer ${CRON_SECRET}`,
};

const from = Number(process.argv[process.argv.indexOf("--from") + 1] || 0) || 0;
let ingested = 0;
let spent = 0;

for (let i = from; ; i += 1) {
  const started = Date.now();
  const response = await fetch(`${APP_URL}/api/internal/connectors/youtube/harvest`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ plan, offset: i, limit: 1, target: 200, videos: 50 }),
  });
  const report = await response.json();
  if (!response.ok) {
    console.error(`[${i}] HTTP ${response.status}`, report);
    process.exit(1);
  }
  ingested += report.ingested;
  spent += report.quotaUnitsSpent;
  console.log(
    `[${i}] found ${String(report.discovered).padStart(3)}  new ${String(report.ingested).padStart(3)}  ` +
      `skipped ${report.skipped.length}  units ${report.quotaUnitsSpent}  ${((Date.now() - started) / 1000).toFixed(0)}s`,
  );
  if (report.stoppedEarly) {
    console.log(`stopped: ${report.stoppedEarly}`);
    console.log(`resume with: node scripts/harvest-places.mjs ${plan === "top" ? "--top " : ""}--from ${i}`);
    break;
  }
  if (report.planRemaining === 0) break;
}
console.log(`total new creators ${ingested}, quota units ${spent}`);
