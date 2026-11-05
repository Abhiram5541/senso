"use client";

import { useState, type CSSProperties } from "react";
import { ArrowUpRight, BarChart3, Compass, Fingerprint, Layers3, Search, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { SpecimenCreator } from "./specimen";
import s from "./marketing-story.module.css";

/** A working, local preview. Filtering and chart controls never call a paid API. */
export function CreatorExplorer({ creators, live }: { creators: SpecimenCreator[]; live: boolean }) {
  const [selected, setSelected] = useState(creators[0]?.handle);
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState<"health" | "confidence">("health");
  const matches = creators.filter(c => `${c.name} ${c.handle} ${c.categories.join(" ")} ${c.market} ${c.platform}`.toLowerCase().includes(query.trim().toLowerCase()));
  const creator = matches.find(c => c.handle === selected) ?? matches[0];
  const chartRows = matches.slice(0, 5);

  return <div className={s.dashboard}>
    <aside className={s.dashboardRail} aria-label="Platform preview navigation">
      <span className={s.dashboardBrand}>SENSO<span>360</span></span>
      <span className={s.workspaceName}>Intelligence workspace</span>
      <a href="#discover" aria-current="location"><Compass size={16} />Discovery</a>
      <a href="#evaluate"><Fingerprint size={16} />Creator health</a>
      <a href="#verify"><ShieldCheck size={16} />Evidence</a>
      <a href="#activate"><Layers3 size={16} />Campaigns</a>
      <a href="#measure"><BarChart3 size={16} />Measurement</a>
      <div className={s.railBottom}><span className={s.connectionDot} />{live ? "Connected to live index" : "Illustrative workspace"}<small>Explore the signals.<br />Understand the difference.</small></div>
    </aside>
    <div className={s.dashboardMain}>
      <div className={s.dashboardToolbar}><div><span>Workspace / Discovery</span><h3>Creator intelligence</h3></div><a href="/register">Open workspace<ArrowUpRight size={14} /></a></div>
      <div className={s.dashboardOverview}>
        <div className={s.chartPanel}>
          <div className={s.chartHeader}><div><strong>Signals at a glance</strong><span>{live ? "Live profile data" : "Illustrative profiles"} · 0–100 scale</span></div><div className={s.metricToggle} aria-label="Chart metric">{(["health", "confidence"] as const).map(m => <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === "health" ? "Health" : "Confidence"}</button>)}</div></div>
          <div className={s.barChart} role="img" aria-label={`${metric === "health" ? "Creator health" : "Data confidence"}: ${chartRows.map(c => `${c.name} ${c[metric]}`).join(", ") || "No matching profiles"}`}>
            <div className={s.chartScale} aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
            <div className={s.chartBars}>{chartRows.map(c => <div className={s.barColumn} key={c.handle}><div className={s.barTrack}><span className={metric === "health" ? s.healthBar : s.confidenceBar} style={{"--value": `${c[metric]}%`} as CSSProperties}><b>{c[metric]}</b></span></div><span className={s.barName}>{c.name}</span></div>)}</div>
          </div>
          <p className={s.chartNote}>Health measures quality. Confidence measures the evidence.</p>
        </div>
        <div className={s.creatorSpotlight} aria-live="polite" aria-atomic="true">
          {creator ? <><div className={s.spotlightHeading}><span>Creator in focus</span><ArrowUpRight size={15} /></div><div className={s.spotlightIdentity}><Avatar name={creator.name} src={creator.avatarUrl} size="lg" /><div><h3>{creator.name}</h3><p>{creator.market || "Market unavailable"} · {creator.platform}</p></div></div><dl><div><dt>Audience</dt><dd>{creator.followers}</dd></div><div><dt>Engagement</dt><dd>{creator.engagement}</dd></div></dl><div className={s.creatorScore}><span>SENSO Health <strong>{creator.health}<small>/100</small></strong></span><span>Confidence<strong>{creator.confidence}<small>%</small></strong></span></div><p className={s.previewHint}>Select a profile below to compare.</p></> : <p>Try a different search to explore a profile.</p>}
        </div>
      </div>
      <div className={s.explorerBar}><strong>Your discovery preview</strong><label className={s.search}><Search size={15} aria-hidden /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search creators, markets, categories…" aria-label="Search preview creators" /></label><span>{matches.length} profiles</span></div>
      <div className={s.creatorList} aria-label="Preview creators">
        <div className={s.listHeading} aria-hidden="true"><span>Creator</span><span>Audience</span><span>Health</span><span>Confidence</span></div>
        {matches.slice(0,4).map(c => <button key={c.handle} type="button" aria-pressed={creator?.handle === c.handle} onClick={() => setSelected(c.handle)}><span className={s.listIdentity}><Avatar name={c.name} src={c.avatarUrl} size="sm" /><span><strong>{c.name}</strong><small>{c.categories[0] || c.platform} · {c.market || c.platform}</small></span></span><span><span className={s.mobileMetricLabel}>Audience</span>{c.followers}</span><span className={s.listHealth}><span className={s.mobileMetricLabel}>Health</span>{c.health}<small>/100</small></span><span><span className={s.mobileMetricLabel}>Confidence</span>{c.confidence}%<ArrowUpRight size={13} /></span></button>)}
        {!matches.length && <p className={s.empty} role="status">No matching preview profiles. Try another name or category.</p>}
      </div>
      <div className={s.explorerFoot}><span>Preview search · no search credits used</span><a href="/register">Explore all creators<ArrowUpRight size={13} /></a></div>
    </div>
  </div>;
}
