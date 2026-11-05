"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/class-names";
import { healthBand } from "@/lib/contracts/score";
import { formatCompact } from "@/lib/format";
import { SensoMark } from "@/components/shell/logo";
import { avatarSrc } from "@/components/ui/avatar";
import type { SpecimenCreator } from "./specimen";

/* ---------------------------------------------------------------------------
 * The hero stage (CLAUDE.md D53).
 *
 * A creator's photograph on a charcoal squircle, with the reading SENSO holds
 * on them floating around it as chips — the composition of the supplied
 * reference. The creators are ones a visitor knows on sight (live.ts,
 * `featuredCreators`); every figure on a chip is the application's reading,
 * never a caption written for the page.
 *
 * It cycles through them every few seconds with a crossfade. Under reduced
 * motion it holds on the first creator, and it pauses while the pointer is
 * over it so a chip can be read.
 * ------------------------------------------------------------------------ */

const BAND_LABEL = { excellent: "Excellent", strong: "Strong", fair: "Fair", weak: "Needs review" } as const;
const CYCLE_MS = 3800;

export function HeroStage({ creators, indexed }: { creators: SpecimenCreator[]; indexed: number }) {
  const [active, setActive] = React.useState(0);
  const paused = React.useRef(false);

  React.useEffect(() => {
    if (creators.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!paused.current) setActive((index) => (index + 1) % creators.length);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [creators.length]);

  const creator = creators[active];
  if (!creator) return null;
  const others = creators.filter((_, index) => index !== active).slice(0, 3);

  return (
    <div
      className="relative mx-auto aspect-[1/1.12] w-full max-w-[34rem] select-none sm:aspect-[1/0.86]"
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
    >
      {/* The ground the composition sits on. */}
      <div aria-hidden className="absolute inset-0 rounded-[2.5rem] bg-sunken" />

      {/* The photograph, on a charcoal squircle. Every creator is rendered
          and only the active one is opaque, so the swap is a crossfade with
          no reload flash. */}
      <div className="absolute left-[20%] top-[12%] aspect-square w-[60%] sm:left-[24%] sm:top-[13%] sm:w-[54%] overflow-hidden rounded-[22%] bg-instrument shadow-overlay">
        {creators.map((c, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={c.id ?? c.handle}
            src={avatarSrc(c.avatarUrl!, 320)}
            alt={index === active ? c.name : ""}
            referrerPolicy="no-referrer"
            loading={index < 2 ? "eager" : "lazy"}
            className={cn(
              "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-700 ease-out",
              index === active ? "scale-100 opacity-100" : "scale-105 opacity-0",
            )}
          />
        ))}
      </div>

      {/* The mark, with the reference's satellite dot. */}
      <span
        aria-hidden
        className="animate-float absolute left-[7%] top-[7%] grid size-[17%] place-items-center rounded-full bg-brand shadow-brand"
      >
        <SensoMark tile={false} className="size-[58%] text-ink" />
        <span className="absolute -right-[6%] -top-[6%] size-[22%] rounded-full bg-brand ring-4 ring-sunken" />
      </span>

      {/* The reading: health and its confidence, never one without the other. */}
      <p
        className="animate-float absolute right-[2%] top-[34%] sm:top-[30%] rounded-[1.75rem] bg-brand px-5 py-3 font-display text-[clamp(0.95rem,0.8rem+0.6vw,1.2rem)] font-semibold leading-tight text-ink shadow-brand"
        style={{ "--float-delay": "-1.5s" } as React.CSSProperties}
      >
        <span className="block">
          SENSO Health <span className="font-num">{creator.health}</span>
        </span>
        <span className="block font-medium">
          {BAND_LABEL[healthBand(creator.health)]} · <span className="font-num">{creator.confidence}%</span> confident
        </span>
      </p>

      {/* Who it is. */}
      <div className="absolute left-0 top-[58%] flex max-w-[72%] items-center sm:top-[56%] sm:max-w-[64%] gap-3 rounded-full bg-surface py-2 pl-2 pr-2 shadow-popover">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
          <BarChart3 className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="label-caps-sm block whitespace-nowrap text-brand-ink">
            {creator.platform} · <span className="font-num">{creator.followers}</span>
          </span>
          <span className="block truncate font-display text-lg font-semibold leading-tight text-ink" aria-live="polite">
            {creator.name}
          </span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(creator.avatarUrl!, 36)}
          alt=""
          referrerPolicy="no-referrer"
          className="size-9 shrink-0 rounded-full object-cover"
        />
      </div>

      {/* The rest of the index, as faces. */}
      <div className="absolute bottom-[4%] right-[3%] flex items-center gap-3 rounded-full bg-instrument py-2 pl-5 pr-2 sm:bottom-[6%] sm:right-[4%] sm:gap-4 sm:py-2.5 sm:pl-6 sm:pr-2.5 text-instrument-ink shadow-overlay">
        <span>
          <span className="label-caps-sm block text-brand-lift">Also indexed</span>
          <span className="block font-display text-lg font-semibold leading-tight">
            <span className="font-num">{formatCompact(indexed)}</span> creators
          </span>
        </span>
        <span className="flex items-center">
          {others.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={c.id ?? c.handle}
              src={avatarSrc(c.avatarUrl!, 40)}
              alt=""
              referrerPolicy="no-referrer"
              className="-ml-2.5 size-10 rounded-full object-cover ring-2 ring-instrument first:ml-0"
            />
          ))}
          <span className="-ml-2.5 grid size-10 place-items-center rounded-full bg-instrument-raised font-num text-xs text-instrument-muted ring-2 ring-instrument">
            +{formatCompact(Math.max(indexed - 3, 0))}
          </span>
        </span>
      </div>
    </div>
  );
}
