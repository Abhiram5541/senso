import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, BadgeCheck, Database, Search, ShieldCheck, Sparkles } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { databaseStats } from "@/server/repositories/ops-repository";
import { summariesComplete } from "@/server/repositories/influencer-repository";
import { CtaPill, MarketingChrome } from "@/components/shell/marketing-chrome";
import { CreatorShowcase } from "@/components/marketing/creator-showcase";
import { HeroStage } from "@/components/marketing/hero-stage";
import { CountUp } from "@/components/marketing/count-up";
import { collectedAgo, featuredCreators, landingCreators, landingFacets, landingQualityPoints } from "@/components/marketing/live";
import { Reveal } from "@/components/marketing/reveal";
import {
  CampaignDeliveryPanel,
  CampaignLeaderboard,
  CreatorDossier,
  DiscoverySurface,
  EnrichmentExtract,
  FACT_STATES,
  ProvenanceDossier,
  QualityCanvas,
  toLiveDossier,
} from "@/components/marketing/product-surfaces";

export const metadata: Metadata = {
  title: "SENSO — Influencer Intelligence",
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
    featured: featuredCreators(),
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

/* ---------------------------------------------------------------------------
 * The landing page (CLAUDE.md D51).
 *
 * An editorial page: headlines set large and light, white paper, one
 * charcoal slab and one orange closing block. It is still ordered by the
 * buyer's journey — meet the creators, then discover, evaluate, verify,
 * activate, measure — and it still lets the product carry the argument
 * (D22): every step leads with a surface composed from the application's own
 * components, and the prose around it is at most two lines.
 *
 * Two rules from earlier versions stand:
 *
 *   1. One grid. Every band sits in the same container with its heading on
 *      the same left edge (D40).
 *   2. Live where it can be. Creators, scores, facet counts, the quality
 *      scatter and every coverage figure are read from the database as the
 *      page renders; the campaign and AI examples are illustrative and the
 *      page says so once, under the hero, and again in the footer.
 * ------------------------------------------------------------------------ */

const STEPS = [
  { href: "#discover", label: "Discover", note: "Search a real index on audience quality, not size." },
  { href: "#evaluate", label: "Evaluate", note: "A deterministic health score with its confidence beside it." },
  { href: "#evidence", label: "Verify", note: "Every figure names its source, method and freshness." },
  { href: "#activate", label: "Activate", note: "Shortlist, agree rates, track the hashtag." },
  { href: "#measure", label: "Measure", note: "Campaign performance scored on its own axis." },
];

const EVALUATE_POINTS = [
  {
    title: "Nine components, published weights",
    body: "Authenticity, engagement quality and rate, growth, view consistency, audience activity, comment quality, upload consistency, brand safety.",
  },
  {
    title: "Confidence is its own axis",
    body: "A creator can score 91 on health with 40% confidence. Folding the two together is the most misleading thing a tool in this category can do.",
  },
  {
    title: "Absent is never zero",
    body: "A component nobody could measure is withheld and the remaining weights renormalise. It is never scored as a nought.",
  },
];

const AI_PROHIBITIONS = [
  "Follower counts",
  "Engagement rates",
  "View counts",
  "Audience demographics",
  "Bot percentages",
  "Any historical metric",
];

const WRAP = "mx-auto max-w-6xl px-5 sm:px-8";

/** Every step opens the same way: an orange number coin, then a large light heading. */
function StepHeader({
  step,
  label,
  title,
  lede,
  compact = false,
  className,
}: {
  step: string;
  label: string;
  title: string;
  lede?: string;
  /** For a heading set in the narrow column of a split: one step down the
   *  display ramp, so it does not wrap word by word. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <p className="flex items-center gap-3 text-base font-medium text-ink-muted">
        <span className="grid size-9 place-items-center rounded-full bg-brand font-num text-sm font-semibold text-ink">
          {step}
        </span>
        {label}
      </p>
      <h2
        className={
          compact
            ? "mt-6 font-display text-[clamp(2rem,1.4rem+2.2vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.04em] text-ink"
            : "display-sm mt-6 max-w-3xl text-ink"
        }
      >
        {title}
      </h2>
      {lede && <p className="mt-5 max-w-xl text-md leading-7 text-ink-muted">{lede}</p>}
    </Reveal>
  );
}

export default function LandingPage() {
  // Real coverage from the running database, a real creator for the hero and
  // the dossier, real rows for the showcase and the search surface, real facet
  // counts and the real quality scatter (live.ts).
  const { stats, rows, dossier, facets, quality, featured } = liveSnapshot();
  const live = [
    { label: "Creators indexed", raw: stats.totalInfluencers, value: formatCompact(stats.totalInfluencers) },
    { label: "Content items read", raw: stats.totalContent, value: formatCompact(stats.totalContent) },
    { label: "Historical snapshots", raw: stats.totalSnapshots, value: formatCompact(stats.totalSnapshots) },
    { label: "Markets", raw: stats.byCountry.length, value: formatCompact(stats.byCountry.length) },
  ];
  const faces = rows.filter((row) => row.avatarUrl);

  return (
    <MarketingChrome>
      {/* ============================================================== HERO
          Headline on the left, the hero stage on the right: a creator the
          visitor knows on sight, with SENSO's reading of them floating
          around the photograph (hero-stage.tsx, D53). */}
      <section className="relative overflow-hidden">
        <div className={`${WRAP} grid items-center gap-x-10 gap-y-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pb-20 lg:pt-20`}>
          <div>
            <Reveal load>
              <p className="inline-flex items-center gap-2 rounded-full bg-sunken px-3.5 py-1.5 text-sm font-medium text-ink-muted">
                <span aria-hidden className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-brand" />
                </span>
                Live index ·{" "}
                <span className="font-num font-semibold text-ink">
                  <CountUp value={stats.totalInfluencers} text={formatCompact(stats.totalInfluencers)} />
                </span>{" "}
                creators
              </p>
            </Reveal>

            <Reveal load delay={60}>
              {/* Two columns cannot carry the full nine-rem display size, so the
                  headline steps down the ramp here and keeps its rhythm. */}
              <h1 className="mt-8 font-display text-[clamp(3.25rem,1.6rem+5.2vw,6.75rem)] font-medium leading-[0.94] tracking-[-0.045em] text-ink">
                <span className="block">Creator</span>
                <span className="block sm:pl-[0.6em]">Intelligence</span>
              </h1>
            </Reveal>

            <Reveal load delay={120}>
              <p className="mt-8 max-w-md text-lg leading-8 text-ink-muted">
                SENSO is the intelligence layer between a shortlist and a signed creator —
                discovery, evaluation, verification and campaign measurement, with evidence
                behind every important number.
              </p>
            </Reveal>

            <Reveal load delay={160} className="mt-10 flex flex-wrap items-center gap-3">
              <CtaPill href="/register" size="lg">
                Request a demo
              </CtaPill>
              <a
                href="#creators"
                className="press inline-flex h-14 items-center gap-2 rounded-full px-6 text-md font-semibold text-ink hover:bg-sunken"
              >
                Meet the creators
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </Reveal>
          </div>

          <Reveal load delay={200} className="min-w-0">
            {featured.length > 0 ? (
              <HeroStage creators={featured} indexed={stats.totalInfluencers} />
            ) : (
              <div className="mx-auto aspect-[1/0.86] w-full max-w-[34rem] rounded-[2.5rem] bg-sunken" />
            )}
          </Reveal>
        </div>

        {/* Real faces from the index, moving. The track holds the row twice
            and travels half its width, so the loop has no seam. */}
        {faces.length >= 4 && (
          <div className="marquee-mask overflow-hidden pb-6" aria-label="Creators in the index">
            <ul className="marquee-track flex w-max gap-3" style={{ "--marquee-duration": "48s" } as React.CSSProperties}>
              {[...faces, ...faces].map((face, index) => (
                <li
                  key={`${face.handle}-${index}`}
                  aria-hidden={index >= faces.length || undefined}
                  className="flex items-center gap-3 rounded-full bg-sunken py-1.5 pl-1.5 pr-5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={face.avatarUrl!}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-10 rounded-full object-cover"
                  />
                  <span className="text-base font-semibold text-ink">{face.name}</span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 font-num text-sm font-semibold text-ink">
                    {face.health}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ========================================================= CREATORS
          The page's one charcoal slab: real creators, read like a dossier. */}
      <section id="creators" className="scroll-mt-24">
        <div className="mx-auto max-w-[90rem] px-3 sm:px-5">
          <Reveal>
            {rows.length >= 3 ? (
              <CreatorShowcase creators={rows} />
            ) : (
              <div className="rounded-[3rem] bg-instrument px-10 py-16 text-instrument-ink">
                <h2 className="display-sm">The creator behind the audience.</h2>
                <p className="mt-5 max-w-md text-md leading-7 text-instrument-muted">
                  The index is still filling. Creators appear here as they are scored.
                </p>
              </div>
            )}
          </Reveal>
          <p className="mx-auto mt-4 max-w-6xl px-2 text-sm text-ink-subtle sm:px-5">
            {dossier
              ? "Creators, scores and coverage on this page are live from the SENSO database. The campaign and AI examples are illustrative."
              : "Product surfaces on this page are the real interface, rendered with illustrative creators. Coverage figures are live."}
          </p>
        </div>
      </section>

      {/* ============================================================== HOW
          The five stops, as a large index the reader can jump through. */}
      <section id="how" className="scroll-mt-24">
        <div className={`${WRAP} pb-8 pt-28 lg:pt-36`}>
          <Reveal>
            <h2 className="display-sm max-w-4xl text-ink">
              From a search to a signed creator, <span className="text-ink-subtle">with the working shown.</span>
            </h2>
          </Reveal>
          <Reveal as="ol" stagger className="mt-14 border-t border-line">
            {STEPS.map((step, index) => (
              <li key={step.href} className="border-b border-line">
                <a
                  href={step.href}
                  className="group grid grid-cols-[3rem_1fr_auto] items-center gap-x-4 py-6 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-x-6"
                >
                  <span className="font-num text-base text-ink-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-[clamp(1.75rem,1.2rem+2.2vw,3rem)] font-medium leading-none tracking-[-0.03em] text-ink transition-colors group-hover:text-brand-ink">
                    {step.label}
                  </span>
                  <span className="col-span-2 col-start-2 row-start-2 mt-2 text-base leading-6 text-ink-muted sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0">
                    {step.note}
                  </span>
                  <span
                    aria-hidden
                    className="col-start-3 row-start-1 grid size-12 place-items-center rounded-full bg-sunken text-ink transition-all group-hover:-rotate-45 group-hover:bg-brand sm:col-start-4"
                  >
                    <ArrowRight className="size-5" />
                  </span>
                </a>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 1 DISCOVER */}
      <section id="discover" className="scroll-mt-24">
        <div className={`${WRAP} py-20 lg:py-28`}>
          <StepHeader
            step="01"
            label="Discover"
            title="Don't choose creators by follower count."
            lede="Search a real index on audience quality. Every facet carries a live count, and the sort is the score, not the size."
          />
          <Reveal className="mt-12">
            <DiscoverySurface
              rows={rows.length >= 5 ? rows : undefined}
              facets={rows.length >= 5 ? facets : undefined}
              matching={rows.length >= 5 ? stats.totalInfluencers : undefined}
            />
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 2 EVALUATE
          Sticky split: the copy holds while the dossier scrolls past it. */}
      <section id="evaluate" className="scroll-mt-24">
        <div className={`${WRAP} grid gap-x-16 gap-y-12 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:py-28`}>
          <div className="lg:sticky lg:top-28">
            <StepHeader step="02" label="Evaluate" title="Understand the creator behind the audience." compact />
            <Reveal as="ul" stagger className="mt-10 space-y-3">
              {EVALUATE_POINTS.map((point) => (
                <li key={point.title} className="rounded-3xl bg-sunken px-6 py-5">
                  <p className="font-display text-lg font-semibold text-ink">{point.title}</p>
                  <p className="mt-1 text-base leading-6 text-ink-muted">{point.body}</p>
                </li>
              ))}
            </Reveal>
          </div>
          <Reveal className="min-w-0">
            <CreatorDossier live={dossier} />
          </Reveal>
        </div>
      </section>

      {/* =========================================================== 3 VERIFY */}
      <section id="evidence" className="scroll-mt-24">
        <div className={`${WRAP} py-20 lg:py-28`}>
          <div className="grid items-start gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <StepHeader
              step="03"
              label="Verify"
              title="Every important number carries its evidence."
              compact
              lede="Most tools hand you a confident figure and no way to check it. Ours shows its working — on any number you might have to defend in a meeting."
            />
            <Reveal className="min-w-0">
              <ProvenanceDossier
                live={
                  dossier
                    ? {
                        engagement: dossier.creator.engagement,
                        collected: collectedAgo(dossier.profile),
                        confidence: dossier.creator.confidence,
                        sourceUrl: dossier.profile.socialAccounts[0]?.url ?? null,
                      }
                    : null
                }
              />
            </Reveal>
          </div>

          <Reveal as="ol" stagger className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FACT_STATES.map((state) => (
              <li key={state.label} className="rounded-3xl bg-sunken px-5 py-5">
                <span className="grid size-10 place-items-center rounded-full bg-surface">
                  <state.icon className={`size-4 ${state.tone}`} aria-hidden />
                </span>
                <p className="mt-4 font-display text-md font-semibold text-ink">{state.label}</p>
                <p className="mt-1 text-sm leading-5 text-ink-muted">{state.detail}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============================================================ BENTO
          The foundation and the AI boundary, as one bento: the live figures
          are the tiles, and the constraint on the model is set as plainly as
          the figures are. */}
      <section id="intelligence" className="scroll-mt-24">
        <div className={`${WRAP} py-20 lg:py-28`}>
          <Reveal>
            <h2 className="display-sm max-w-3xl text-ink">
              Where the numbers come from.
            </h2>
          </Reveal>

          <Reveal stagger className="mt-12 grid gap-3 md:grid-cols-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-brand p-7 text-ink md:col-span-3 md:row-span-3 lg:p-9">
              <Database className="size-7" aria-hidden />
              <p className="mt-20 font-num text-[clamp(4rem,3rem+5vw,7.5rem)] font-semibold leading-none tracking-[-0.04em]">
                <CountUp value={live[0].raw} text={live[0].value} />
              </p>
              <p className="mt-3 font-display text-xl font-medium">{live[0].label}</p>
              <p className="mt-2 max-w-sm text-base leading-6">
                Live from the SENSO database as this page rendered — collected from official
                platform APIs and creator-authorised accounts. No purchased list.
              </p>
              <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 size-64 rounded-full border-[2.5rem] border-ink/10" />
            </div>
            {live.slice(1).map((figure, index) => (
              <div
                key={figure.label}
                className={`rounded-[2rem] p-7 md:col-span-3 ${index === 1 ? "bg-ink text-ink-inverse" : "bg-sunken"}`}
              >
                <p className="font-num text-metric-lg font-semibold leading-none">
                  <CountUp value={figure.raw} text={figure.value} />
                </p>
                <p className={`mt-2 text-base ${index === 1 ? "text-instrument-muted" : "text-ink-muted"}`}>
                  {figure.label}
                </p>
              </div>
            ))}
            <div className="rounded-[2rem] bg-sunken p-7 md:col-span-6 lg:p-9">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <span className="grid size-12 place-items-center rounded-full bg-brand text-ink">
                    <Sparkles className="size-6" aria-hidden />
                  </span>
                  <p className="mt-6 font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] font-medium leading-tight tracking-[-0.03em]">
                    AI explains the score. It never sets it.
                  </p>
                  <p className="mt-4 max-w-md text-base leading-6 text-ink-muted">
                    Models classify, extract and explain, in strict schema mode, and every reply is
                    re-validated before anything is stored — the prohibition is enforced by there
                    being no field to fill.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-muted">A model may never produce</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {AI_PROHIBITIONS.map((item) => (
                      <li
                        key={item}
                        className="rounded-full bg-surface px-4 py-2 text-base text-ink"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 min-w-0">
                    <EnrichmentExtract />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 4 ACTIVATE */}
      <section id="activate" className="scroll-mt-24">
        <div className={`${WRAP} py-20 lg:py-28`}>
          <StepHeader
            step="04"
            label="Activate"
            title="From creator selection to measurable delivery."
            lede="Select talent from a shortlist, record the agreed rate, set a tracking hashtag, and SENSO attributes what each creator actually delivered."
          />
          <div className="mt-12 grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <Reveal>
              <CampaignDeliveryPanel />
            </Reveal>
            <Reveal delay={100} className="min-w-0">
              <CampaignLeaderboard />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========================================================== 5 MEASURE */}
      <section id="measure" className="scroll-mt-24">
        <div className={`${WRAP} py-20 lg:py-28`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <StepHeader step="05" label="Measure" title="Quality on one axis. Evidence on the other." />
            <Reveal as="ul" className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              {[
                ["bg-positive", "Excellent"],
                ["bg-series-1", "Strong"],
                ["bg-caution", "Fair"],
                ["bg-critical", "Needs review"],
              ].map(([dot, label]) => (
                <li key={label} className="inline-flex items-center gap-2 rounded-full bg-sunken px-3.5 py-1.5">
                  <span aria-hidden className={`size-2 rounded-full ${dot}`} />
                  {label}
                </li>
              ))}
            </Reveal>
          </div>

          <Reveal className="mt-12 overflow-hidden rounded-[2rem] bg-surface shadow-overlay">
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 pt-5">
              <span className="font-display text-md font-semibold text-ink">
                Data confidence against SENSO Health
              </span>
              <span className="text-sm text-ink-subtle">Every scored profile in the index</span>
            </div>
            <div className="px-6 py-5">
              <QualityCanvas points={quality.length >= 50 ? quality : undefined} />
            </div>
            <div className="border-t border-rule px-6 py-4 text-base leading-6 text-ink-muted">
              {quality.length >= 50
                ? "Confidence sits in the middle band for every creator: the index is read from official platform APIs, and no creator has yet connected an account. A creator scoring 90 on that evidence is exactly the case this axis exists to expose — and what every other tool would show you as a clean 90."
                : "Draw a shortlist from the top-right quadrant: creators scoring above 70 on evidence that is itself above 70% confident. The cluster low and to the right is the case this axis exists to expose — a strong score on history too thin to rely on."}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================== CTA
          The closing block is the brand itself, at page width. */}
      <section>
        <div className="mx-auto max-w-[90rem] px-3 pb-6 sm:px-5">
          <Reveal className="relative overflow-hidden rounded-[2.5rem] bg-brand px-6 py-16 text-ink sm:px-10 lg:rounded-[3rem] lg:px-14 lg:py-24">
            <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full border-[4rem] border-ink/[0.07]" />
            <div className="relative mx-auto max-w-6xl">
              <h2 className="display-lg max-w-4xl">Bring your own shortlist.</h2>
              <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
                <p className="max-w-md text-lg leading-8">
                  Start with five searches a month, free. Saved profiles, shortlists and
                  comparisons stay available whether or not you have searches left.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <CtaPill href="/register" size="lg">
                    Request a demo
                  </CtaPill>
                  <a
                    href="/pricing"
                    className="press inline-flex h-14 items-center gap-2 rounded-full bg-surface px-6 text-md font-semibold text-ink hover:bg-brand-softer"
                  >
                    See plans
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </div>
              </div>
              <ul className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/15 pt-6 text-base">
                {[
                  [Search, "Search on audience quality"],
                  [ShieldCheck, "Evidence on every figure"],
                  [BadgeCheck, "Verified only through OAuth"],
                ].map(([Icon, label]) => {
                  const I = Icon as typeof Search;
                  return (
                    <li key={label as string} className="flex items-center gap-2">
                      <I className="size-4" aria-hidden />
                      {label as string}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingChrome>
  );
}
