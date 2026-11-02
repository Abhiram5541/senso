/* ---------------------------------------------------------------------------
 * Process-wide store for the development driver.
 *
 * Next builds route handlers and server components into separate module
 * graphs, so a plain module-level `const rows = []` is instantiated more than
 * once: a write from a route handler would be invisible to the page that
 * renders next. Anchoring the state on `globalThis` gives every bundle — and
 * every hot reload — the same object.
 *
 * The development driver's records live here for that reason. So do the
 * scoring caches (`senso.scoring`), which are derived rather than stored and
 * so are duplicated per graph under either driver: before they were anchored,
 * the boot scoring pass warmed one graph while page renders took the whole
 * pass again in another.
 * ------------------------------------------------------------------------ */

const REGISTRY = Symbol.for("socialorbit.dev.store");

type Registry = Map<string, unknown>;

function registry(): Registry {
  const host = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
  host[REGISTRY] ??= new Map();
  return host[REGISTRY];
}

/**
 * Returns the one instance of `key`, creating it from `seed` the first time.
 * The seed runs at most once per process.
 */
export function shared<T>(key: string, seed: () => T): T {
  const store = registry();
  if (!store.has(key)) store.set(key, seed());
  return store.get(key) as T;
}

/** Installs `value` as the one instance of `key`, replacing any seed already made. */
export function replaceShared<T>(key: string, value: T): void {
  registry().set(key, value);
}

/** Test seam: drops everything so a suite can start from the seed again. */
export function __resetSharedStore(): void {
  registry().clear();
}
