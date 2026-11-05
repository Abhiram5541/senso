import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Database, Fingerprint, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatCompact } from "@/lib/format";
import { CreatorExplorer } from "./creator-explorer";
import { SPECIMEN_CAMPAIGN, SPECIMEN_DOSSIER, SPECIMEN_ENRICHMENT, SPECIMEN_QUALITY_POINTS, SPECIMEN_RESULTS, type SpecimenCreator } from "./specimen";
import { CampaignDeliveryPanel, CampaignLeaderboard, CreatorDossier, DiscoverySurface, EnrichmentExtract, ProvenanceDossier, QualityCanvas, type LiveDossier } from "./product-surfaces";
import { collectedAgo } from "./live";
import s from "./marketing-story.module.css";

function Details({ label, children }: { label: string; children: ReactNode }) {
  return <details className={s.details}><summary>{label}<ChevronDown size={17} aria-hidden /></summary><div className={s.expanded}>{children}</div></details>;
}
function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className={s.textLink} href={href}>{children}<ArrowUpRight size={17} aria-hidden /></a>;
}

export function MarketingStory({ rows, dossier, facets, quality, stats }: {
  rows: SpecimenCreator[];
  dossier: LiveDossier | null;
  facets: { group: string; options: [string, string][] }[];
  quality: { x: number; y: number; tone: "positive" | "brand" | "caution" | "critical" }[];
  stats: { totalInfluencers: number; totalContent: number; totalSnapshots: number; byCountry: unknown[] };
}) {
  const creator = dossier?.creator ?? SPECIMEN_DOSSIER;
  const campaign = SPECIMEN_CAMPAIGN;
  const plotted = quality.length >= 50 ? quality : SPECIMEN_QUALITY_POINTS;
  const highHealth = plotted.filter(p => p.x >= 70).length;
  const highConfidence = plotted.filter(p => p.y >= 70).length;
  return <>
    <section id="discover" className={s.discover}>
      <div className={s.container}>
        <div className={s.opening}><h2>The whole picture.<br /><span>One intelligent workspace.</span></h2><p>Discover creators, compare the signals, and build your next shortlist. Explore a live preview of the intelligence behind every partnership.</p></div>
        <div className={s.discoveryLayout}>
          <CreatorExplorer creators={rows.length ? rows : SPECIMEN_RESULTS} live={rows.length > 0} />
        </div>
        <div className={s.discoveryBenefits}><span><Check size={15} />Search by category, market and platform</span><span><Check size={15} />Compare quality and confidence</span><span><Check size={15} />Build a shortlist you can act on</span></div>
        <p className={s.disclosure}>{rows.length ? "Profiles and coverage are live from the SENSO database." : "Profiles are illustrative; coverage is live from the SENSO database."} Campaign and AI examples below are illustrative.</p>
        <Details label="Explore the full discovery interface"><DiscoverySurface rows={rows.length >= 5 ? rows : undefined} facets={rows.length >= 5 ? facets : undefined} matching={rows.length >= 5 ? stats.totalInfluencers : undefined} /></Details>
      </div>
    </section>

    <section id="evaluate" className={s.evaluate}>
      <div className={s.container}>
        <div className={s.evaluationHeader}><h2>Go deeper than<br /><span>the follower count.</span></h2><p>A clear view of creator quality, with the strength of the evidence always in sight. Two readings. Better decisions.</p></div>
        <div className={s.evaluationCanvas}>
          <div className={s.identity}><Avatar name={creator.name} src={creator.avatarUrl} size="lg" /><div><strong>{creator.name}</strong><span>{creator.platform} · {creator.market || "Market not available"}</span></div><span className={s.dataTag}>{dossier ? "Live profile" : "Illustrative profile"}</span></div>
          <div className={s.scorePair}>
            <div><div className={s.scoreOrb} style={{"--score": `${creator.health}%`} as CSSProperties}><div className={s.bigScore}>{creator.health}<span>/100</span></div></div><div><p>SENSO Health</p><h3>The quality<br />of the creator.</h3><p>Nine weighted signals.<br />A reproducible formula.</p></div></div>
            <div><div className={`${s.scoreOrb} ${s.confidenceOrb}`} style={{"--score": `${creator.confidence}%`} as CSSProperties}><div className={s.bigScore}>{creator.confidence}<span>%</span></div></div><div><p>Data confidence</p><h3>The strength<br />of the evidence.</h3><p>A separate reading of how much<br />the available data can tell you.</p></div></div>
          </div>
          <div className={s.evaluationBottom}><Fingerprint size={20} aria-hidden /><span>A strong score and thin evidence can coexist. SENSO shows both.</span><a href="#verify">See the evidence <ArrowRight size={16} aria-hidden /></a></div>
        </div>
        <Details label="See the complete creator dossier"><CreatorDossier live={dossier} /></Details>
      </div>
    </section>

    <section id="verify" className={s.verify}>
      <div className={s.container}>
        <div className={s.evidenceLayout}>
          <div className={s.evidenceVisual}>
            <div className={s.evidenceSeal}><ShieldCheck size={32} strokeWidth={1.3} aria-hidden /></div>
            <div className={s.evidenceReading}><span>Engagement rate</span><strong>{creator.engagement}</strong><span>Derived from observed data</span></div>
            <div className={s.evidenceReceipt}><div><Database size={18} aria-hidden /><span>Source<strong>Official platform API</strong></span></div><div><Layers3 size={18} aria-hidden /><span>Method<strong>Published, versioned formula</strong></span></div><div><Fingerprint size={18} aria-hidden /><span>Confidence<strong>{creator.confidence}% · shown separately</strong></span></div></div>
          </div>
          <div className={s.featureCopy}><h2>Every insight.<br /><span>A trail of evidence.</span></h2><p>Every important number has a source, a method and a collection time. Open the evidence. Understand the gaps. Take a decision you can defend.</p><TextLink href="#intelligence">Intelligence with accountability</TextLink><Details label="Inspect the provenance example"><ProvenanceDossier live={dossier ? { engagement: creator.engagement, collected: collectedAgo(dossier.profile), confidence: creator.confidence, sourceUrl: dossier.profile.socialAccounts[0]?.url ?? null } : null} /></Details></div>
        </div>
      </div>
    </section>

    <section id="intelligence" className={s.intelligence}>
      <div className={s.container}>
        <div className={s.aiLayout}><div className={s.featureCopy}><h2>A clearer read.<br /><span>Not another guess.</span></h2><p>AI connects the context: what a creator talks about, why their audience listens, and which themes keep coming back. The scores stay grounded in measured data.</p><TextLink href="/register">Meet your intelligence layer</TextLink></div>
          <div className={s.aiNote}><div className={s.noteHeader}><Sparkles size={18} aria-hidden /><span>SENSO intelligence</span><small>Illustrative analysis</small></div><h3>{SPECIMEN_ENRICHMENT.creatorType}</h3><p>{SPECIMEN_ENRICHMENT.audienceIntent}</p><div className={s.themes}>{SPECIMEN_ENRICHMENT.themes.map(t => <span key={t}>{t}</span>)}</div><div className={s.noteFooter}><Check size={15} aria-hidden />AI explains. Formulas score.</div></div>
        </div>
        <Details label="Read the full AI example and its boundaries"><EnrichmentExtract /><p className={s.detailNote}>AI may classify, extract and explain. It may never create follower counts, engagement rates, view counts, audience demographics, bot percentages or historical metrics. Every output stores its provider, model, prompt version, schema version and evidence.</p></Details>
      </div>
    </section>

    <section id="activate" className={s.activate}>
      <div className={s.container}>
        <div className={s.campaignHeader}><h2>From the right people<br /><span>to measurable impact.</span></h2><p>One connected story, from your first shortlist to the final campaign report. See exactly what each partnership delivered.</p></div>
        <div className={s.campaignScene}>
          <div className={s.campaignBrief}><div className={s.campaignIcon}><Layers3 size={26} aria-hidden /></div><p>Campaign workspace</p><h3>{campaign.name}</h3><span className={s.hashtag}>#{campaign.hashtag}</span><div className={s.partners}>{campaign.participants.map(c => <Avatar key={c.name} name={c.name} size="md" />)}<span>{campaign.participants.length} creators</span></div><small>Illustrative campaign</small></div>
          <div className={s.campaignResults}>
            <div className={s.deliveryLabel}><span>Creator → content → contribution</span><ArrowUpRight size={18} aria-hidden /></div>
            <h3 className={s.contributionTitle}>See each partnership<br />through to its impact.</h3>
            <div className={s.contributionFlow}>
              <div><Avatar name={campaign.participants[0].name} size="lg" /><strong>{campaign.participants[0].name}</strong><span>Campaign creator</span></div>
              <ArrowRight size={20} aria-hidden />
              <div><Layers3 size={30} strokeWidth={1.3} aria-hidden /><strong>{campaign.participants[0].posts} published posts</strong><span>Attributed by hashtag</span></div>
              <ArrowRight size={20} aria-hidden />
              <div><span className={s.reachValue}>{campaign.participants[0].reach}</span><strong>Attributed reach</strong><span>From this creator</span></div>
            </div>
            <div className={s.campaignTotals}><span>Across the campaign</span><strong>{campaign.attributedPosts} posts · {campaign.reach} reach</strong></div>
            <p>Every creator’s contribution stays connected to the campaign. Performance is scored separately from overall SENSO Health.</p>
          </div>
        </div>
        <Details label="Explore campaign delivery and creator performance"><div className={s.campaignDetails}><CampaignDeliveryPanel /><CampaignLeaderboard /></div></Details>
      </div>
    </section>

    <section id="measure" className={s.measure}>
      <div className={s.container}>
        <div className={s.measureLayout}><div className={s.featureCopy}><h2>Know what worked.<br /><span>Know why it matters.</span></h2><p>Read quality alongside evidence. Compare creator performance, measure campaign delivery, and keep confidence visible when you decide what comes next.</p><TextLink href="/pricing">Find the right plan</TextLink></div><div className={s.plot}><div className={s.plotCaption}><span>The SENSO perspective</span><span>{quality.length >= 50 ? "Live index" : "Illustrative distribution"}</span></div><div className={s.desktopPlot}><QualityCanvas points={plotted} /></div>
          <div className={s.mobilePlot}>
            <p>{plotted.length.toLocaleString("en-US")} creators. Two different readings.</p>
            {[["Health ≥ 70", highHealth], ["Confidence ≥ 70%", highConfidence]].map(([label, count]) => <div className={s.distributionRow} key={String(label)}><div><span>{label}</span><strong>{count} of {plotted.length}</strong></div><div className={s.distributionTrack}><span style={{ width: `${Number(count) / plotted.length * 100}%` }} /></div></div>)}
            <details className={s.details}><summary>View the complete distribution<ChevronDown size={16} aria-hidden /></summary><QualityCanvas points={plotted} /></details>
          </div><p>Every point is a creator. Health and confidence remain separate axes.</p></div></div>
      </div>
    </section>

    <section className={s.foundation}>
      <div className={s.container}><div className={s.foundationIntro}><h2>Built on evidence.<br /><span>Open about its limits.</span></h2><p>Official platform APIs, authorised connections and permitted research. The coverage below is read from the database.</p></div><dl className={s.coverage}>{[[stats.totalInfluencers,"Creators indexed"],[stats.totalContent,"Content items read"],[stats.totalSnapshots,"Historical snapshots"],[stats.byCountry.length,"Markets"]].map(([n,label]) => <div key={String(label)}><dt>{label}</dt><dd>{formatCompact(Number(n))}</dd></div>)}</dl><div className={s.sourceTrail}><span>Platform APIs</span><ArrowRight size={14} aria-hidden /><span>Snapshots</span><ArrowRight size={14} aria-hidden /><span>Versioned scoring</span><ArrowRight size={14} aria-hidden /><span>Evidence-backed insight</span></div></div>
    </section>
  </>;
}
