import { Activity, PlayCircle, UserRound, Zap } from "lucide-react";
import { cn } from "@/lib/class-names";
import { healthBand } from "@/lib/contracts/score";
import { avatarSrc } from "@/components/ui/avatar";
import type { SpecimenCreator } from "./specimen";

/* ---------------------------------------------------------------------------
 * The creator showcase (CLAUDE.md D51).
 *
 * The landing page's one charcoal slab. Each card is a real creator from the
 * index (live.ts), read the way a dossier is: who they are on an orange name
 * bar, then two panels that carry only what SENSO measured — the health
 * score with its confidence beside it, and the first-pass signals. Nothing
 * on a card is written for it; a figure the platform did not report renders
 * as "—", exactly as the application does.
 * ------------------------------------------------------------------------ */

const BAND_LABEL = {
  excellent: "Excellent",
  strong: "Strong",
  fair: "Fair",
  weak: "Needs review",
} as const;

export function CreatorShowcase({ creators }: { creators: SpecimenCreator[] }) {
  const cards = creators.filter((c) => c.avatarUrl).slice(0, 3);

  return (
    <div className="grid-lines relative overflow-hidden rounded-[2.5rem] bg-instrument px-5 pb-10 pt-8 text-instrument-ink sm:px-10 sm:pb-14 lg:rounded-[3rem] lg:px-14 lg:pt-12">
      {/* One warm bloom from the top edge — the light the cards sit in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 left-1/2 size-[24rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl sm:size-[44rem] sm:bg-brand/15"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="display-sm text-instrument-ink">
            The creator behind the audience.
          </h2>
          <p className="mt-5 max-w-md text-md leading-7 text-instrument-muted">
            Real creators from the index, as SENSO reads them: a deterministic health
            score, the confidence behind it, and the signals it was drawn from.
          </p>
        </div>
        <div aria-hidden className="flex gap-2">
          <span className="animate-float grid size-14 place-items-center rounded-full bg-surface text-brand">
            <Zap className="size-6 fill-current" />
          </span>
          <span
            className="animate-float grid size-14 place-items-center rounded-full bg-brand text-ink"
            style={{ "--float-delay": "-2s" } as React.CSSProperties}
          >
            <Activity className="size-6" />
          </span>
        </div>
      </div>

      <ul className="relative mt-12 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((creator, index) => (
          <li
            key={creator.id ?? creator.handle}
            // The staggered drop is the reference's rhythm: cards set at
            // different heights read as people, not as a product grid.
            className={cn(index === 1 && "md:mt-24", index === 2 && "lg:mt-12")}
          >
            <CreatorCard creator={creator} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreatorCard({ creator }: { creator: SpecimenCreator }) {
  const band = BAND_LABEL[healthBand(creator.health)];

  return (
    <article className="space-y-2.5">
      <div className="photo-fade aspect-[1/1.02] overflow-hidden rounded-[2rem] bg-surface">
        {/* Remote creator avatars come from the platforms' CDNs; a plain img
            avoids an optimisation pass over arbitrary hosts (as Avatar does). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(creator.avatarUrl!, 320)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
        />
        <span className="absolute left-4 top-4 z-10 grid size-14 place-items-center rounded-full bg-brand text-ink">
          {creator.platform === "YouTube" ? (
            <PlayCircle className="size-6" aria-hidden />
          ) : (
            <UserRound className="size-6" aria-hidden />
          )}
          <span className="sr-only">{creator.platform}</span>
        </span>
      </div>

      <div className="flex items-end justify-between gap-4 rounded-2xl bg-brand px-5 py-3.5 text-ink">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-semibold tracking-tight">
            {creator.name}
          </h3>
          <p className="truncate text-base">
            {creator.categories[0] ?? creator.platform} · {creator.market}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-num text-lg font-semibold leading-none">
            {creator.followers}
          </span>
          <span className="text-sm">followers</span>
        </p>
      </div>

      <dl className="slab-card rounded-2xl px-5 py-4">
        <dt className="text-base font-medium text-instrument-ink">SENSO Health</dt>
        <dd className="mt-2 flex items-end justify-between gap-4">
          <span className="flex items-baseline gap-1">
            <span className="font-num text-metric font-semibold leading-none text-instrument-ink">
              {creator.health}
            </span>
            <span className="font-num text-base text-instrument-muted">/100</span>
          </span>
          <span className="text-right text-sm leading-5 text-instrument-muted">
            {band}
            <br />
            <span className="font-num">{creator.confidence}%</span> confidence
          </span>
        </dd>
      </dl>

      <dl className="slab-card grid grid-cols-3 divide-x divide-instrument-line rounded-2xl py-4">
        <Signal label="Engagement" value={creator.engagement} />
        <Signal label="Median views" value={creator.medianViews} />
        <Signal label="Activity" value={creator.activity} />
      </dl>
    </article>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4">
      <dt className="truncate text-sm text-instrument-muted">{label}</dt>
      <dd className="mt-1 truncate font-num text-lg font-semibold text-instrument-ink">{value}</dd>
    </div>
  );
}
