import { cn } from "@/lib/class-names";

/**
 * The SENSO mark (CLAUDE.md D52): a geometric S on an orange tile.
 *
 * The S is one stroke — two bars and two half-rings, the orbit device the
 * score dial is drawn from — so it reads at 16px as a shape rather than as
 * a letter rendered small. The tile's 28% corner is the same squircle the
 * landing page's hero tile uses. `MARK_PATH` and `MARK_TILE` are shared
 * with the favicon (`src/app/icon.svg`) and the generated Apple icon so the
 * three can never drift.
 */
export const MARK_PATH = "M 42 17 H 28.5 A 7.5 7.5 0 0 0 28.5 32 H 35.5 A 7.5 7.5 0 0 1 35.5 47 H 22";
export const MARK_STROKE = 7;
/** The brand orange and ink by value: an SVG favicon cannot read a CSS variable. */
export const MARK_TILE = "#ff4f1f";
export const MARK_INK = "#111111";

export function SensoMark({
  className,
  tile = true,
}: {
  className?: string;
  /** Draw the orange tile behind the S. Off where the surface is already
   *  orange — the S then takes the current text colour. */
  tile?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-7", className)} aria-hidden>
      {tile && <rect width="64" height="64" rx="18" fill={MARK_TILE} />}
      <path
        d={MARK_PATH}
        fill="none"
        stroke={tile ? MARK_INK : "currentColor"}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The mark and the name. The name is set lowercase in the display voice —
 * the same "senso" the marketing footer sets at page width — with the
 * descriptor in caps beneath it where there is room.
 */
export function Wordmark({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  /** For the charcoal slab and other dark surfaces. */
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <SensoMark className="size-8" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-[1.375rem] font-bold leading-none tracking-[-0.04em]",
              inverse ? "text-instrument-ink" : "text-ink",
            )}
          >
            senso
          </span>
          <span
            className={cn(
              "label-caps-sm mt-1",
              inverse ? "text-instrument-muted" : "text-ink-subtle",
            )}
          >
            Influencer Intelligence
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * A client organisation's own mark, where their workspace would otherwise
 * show the SENSO wordmark. The image sits in a white tile at wordmark height
 * so any logo — light, dark, wide — reads on the pill; the organisation's
 * name follows it. Product terms elsewhere (SENSO Health, SENSO Verified)
 * are unchanged: this brands the workspace, not the measurement.
 */
export function OrgMark({
  name,
  logoUrl,
  compact = false,
  className,
}: {
  name: string;
  logoUrl: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no optimisation pass wanted */}
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="h-9 w-auto max-w-40 rounded-md object-contain"
        referrerPolicy="no-referrer"
      />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-md font-extrabold tracking-wide text-ink">{name}</span>
          <span className="label-caps-sm mt-0.5 text-ink-subtle">Influencer Intelligence</span>
        </span>
      )}
    </span>
  );
}
