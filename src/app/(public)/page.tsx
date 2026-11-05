import type { Metadata } from "next";
import Image from "next/image";
import styles from "./landing.module.css";
import { ArrowDown, ArrowRight, ArrowUpRight, Radar, ShieldCheck, Workflow } from "lucide-react";
import { databaseStats } from "@/server/repositories/ops-repository";
import { summariesComplete } from "@/server/repositories/influencer-repository";
import { LinkButton } from "@/components/ui/button";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { landingCreators, landingFacets, landingQualityPoints } from "@/components/marketing/live";
import { Reveal } from "@/components/marketing/reveal";
import { toLiveDossier } from "@/components/marketing/product-surfaces";
import { MarketingStory } from "@/components/marketing/marketing-story";
import { formatCompact } from "@/lib/format";

export const metadata: Metadata = {
  title: "SENSO360 — Influencer Intelligence",
  description:
    "Find the creators worth betting your brand on. Discovery, evaluation, verification and campaign measurement for marketing teams — with evidence behind every important number.",
};

// The proof bar reads the live database, so the page is rendered at runtime.
//
// It is NOT prerendered with `revalidate`, which was tried and reverted: the
// record set is loaded asynchronously at boot (`instrumentation.ts`) and
// static generation does not wait for it, so the build prerendered a page
// reading "0 creators indexed" and ISR then served that for an hour. The
// build log says so in as many words — "ingested store read before warm-up;
// serving empty until it runs". A marketing page claiming an empty database
// is a worse failure than a slow one, on this product especially.
export const dynamic = "force-dynamic";

/**
 * The live reads behind the page, computed once an hour rather than once a
 * visitor.
 *
 * `force-dynamic` means no page cache, and these four calls are the cost:
 * the facet counts, the quality scatter and the coverage stats each walk
 * every scored creator, and the hero is a full profile assembly. At 12.6k
 * creators on the production box that was ~7s of event loop *per request* —
 * and because the process is single-threaded and is the whole server, other
 * routes queued behind it.
 *
 * The record set moves on a daily cadence (D30's two jobs), so an hour-old
 * read is indistinguishable from a fresh one here.
 *
 * An empty read is never cached. That is not defensiveness: caching one is
 * exactly how the prerender above shipped zeros to production.
 */
const LIVE_TTL_MS = 60 * 60_000;
let liveCache: { at: number; value: LandingSnapshot } | null = null;

type LandingSnapshot = ReturnType<typeof readLive>;

function readLive() {
  const stats = databaseStats();
  const { hero, rows } = landingCreators();
  return {
    stats,
    rows,
    dossier: hero ? toLiveDossier(hero, rows[0]) : null,
    facets: landingFacets(),
    quality: landingQualityPoints(),
  };
}

function liveSnapshot(): LandingSnapshot {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL_MS) return liveCache.value;
  const value = readLive();
  // Only a complete read is worth keeping for an hour. During warm-up
  // `allSummaries` returns a growing subset, so the facets and the scatter are
  // honest but partial — caching one pinned a scatter of 111 cells where the
  // finished pass gives 638. Row counts cannot detect that: the hero appears
  // as soon as anything is scored.
  if (value.stats.totalInfluencers > 0 && value.rows.length > 0 && summariesComplete()) {
    liveCache = { at: Date.now(), value };
  }
  return value;
}

const WRAP = `mx-auto max-w-6xl px-5 sm:px-8 ${styles.wrap}`;

export default function LandingPage() {
  // Real coverage from the running database — the only unmarked figures on the
  // page, because they are the only ones that were measured — a real creator
  // for the preview and the dossier, real rows for the search surface, real facet
  // counts and the real quality scatter. The campaign and AI examples stay
  // illustrative (live.ts says why) and are disclosed.
  const { stats, rows, dossier, facets, quality } = liveSnapshot();
  return (
    <MarketingChrome className={styles.landing} landing onDark>
      <section className={styles.hero}>
        <div className={styles.globeArt} aria-hidden="true"><Image src="/brand/senso-globe.webp" alt="" width={1536} height={1024} priority sizes="(max-width: 767px) 100vw, 1000px" /></div>
        <div className={`${WRAP} ${styles.heroInner}`}>
          <Reveal load className={styles.heroCopy}>
            <h1 className={styles.headline}>A world of influence.<br /><span>A clearer view.</span></h1>
            <p>Turn creator data into your next confident decision. Discover the right people, understand their audience, and measure what matters.</p>
            <div className={styles.heroActions}>
              <LinkButton href="/register" variant="primary" size="lg">Start free <ArrowUpRight size={17} aria-hidden /></LinkButton>
              <a href="#discover">Explore the platform <ArrowRight size={16} aria-hidden /></a>
            </div>
            <p className={styles.heroAssurance}>Built for brands. Grounded in evidence.</p>
          </Reveal>
          <div className={styles.globeCaption}><span className={styles.signalDot} /><span>Influence, connected.<small>Conceptual network visualization</small></span></div>
        </div>
        <div className={`${WRAP} ${styles.heroFoot}`}><span>From discovery to measurable impact.</span><a href="#discover" aria-label="Scroll to discover"><ArrowDown size={16} aria-hidden /></a></div>
        <div className={`${WRAP} ${styles.capabilities}`}>
          <a href="#discover"><Radar size={23} strokeWidth={1.4} /><span><strong>Find your next partnership</strong><small>{formatCompact(stats.totalInfluencers)} creators indexed · {stats.byCountry.length} markets</small></span><ArrowUpRight size={16} /></a>
          <a href="#verify"><ShieldCheck size={23} strokeWidth={1.4} /><span><strong>See the evidence behind it</strong><small>Source, confidence and context</small></span><ArrowUpRight size={16} /></a>
          <a href="#activate"><Workflow size={23} strokeWidth={1.4} /><span><strong>Connect decisions to results</strong><small>Shortlists, campaigns and reporting</small></span><ArrowUpRight size={16} /></a>
        </div>
      </section>

      <MarketingStory rows={rows} dossier={dossier} facets={facets} quality={quality} stats={stats} />

      {/* Closing action, preserving the existing registration and pricing routes. */}
      <section className={styles.closingSection}>
        <div className={`${WRAP} pb-16 pt-2 lg:pb-20`}>
          <Reveal className={`relative overflow-hidden rounded-3xl bg-instrument px-6 py-12 text-instrument-ink sm:px-10 lg:px-14 lg:py-16 ${styles.closing}`}>
            <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div className="max-w-xl">
                <h2 className="display-sm text-instrument-ink">
                  Influence moves fast.<br /><span>Move with clarity.</span>
                </h2>
                <p className="mt-4 text-md leading-7 text-instrument-muted">
                  Start with five searches a month, free. Saved profiles, shortlists and
                  comparisons stay available whether or not you have searches left.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="/register" variant="primary" size="lg">
                  Start free
                </LinkButton>
                <LinkButton
                  href="/pricing"
                  size="lg"
                  variant="ghost"
                  className="text-instrument-ink hover:bg-instrument-raised hover:text-instrument-ink"
                >
                  See plans
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingChrome>
  );
}
