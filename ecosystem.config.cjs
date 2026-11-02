/**
 * PM2 definition for the VPS (CLAUDE.md D34, D42). One fork-mode instance —
 * the read model is in memory — with the heap raised to what the box can
 * give it: the whole database is resident, measured at ~110 MB per thousand
 * creators, and Node's default 2 GB limit would be reached near 18k.
 * `max_memory_restart` sits above the heap limit so PM2 only ever restarts a
 * process that has already failed to collect, never a healthy large one.
 */
const app = (name, cwd, port, heapMb) => ({
  name,
  script: "npm",
  args: `start -- -p ${port}`,
  cwd,
  exec_mode: "fork",
  instances: 1,
  max_memory_restart: `${heapMb + 500}M`,
  env: {
    NODE_ENV: "production",
    NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
  },
});

module.exports = {
  apps: [
    app("senso", "/home/senso/htdocs/srv1082984.hstgr.cloud", 3005, 4096),
    // Staging: same box, its own database (senso_staging), no daily jobs, no
    // outbound mail. Deployed with SENSO_TARGET=staging scripts/deploy-vps.sh.
    // 1 GB, not 2: staging holds 8,678 creators at ~960 MB resident and is
    // idle between deploys, while it shares 7.9 GB of RAM with production's
    // 4 GB heap and the box's other sites. Measured at 1,484 MB free with
    // 2.8 GB already in swap, a staging heap that may grow to 2 GB is a
    // production stall waiting to happen. Raise it only if a restore of a
    // larger database needs it.
    app("senso-staging", "/home/senso-staging/htdocs/staging.srv1082984.hstgr.cloud", 3015, 1024),
  ],
};
