import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/class-names";
import { initials } from "@/lib/format";
import type { VerificationStatus } from "@/lib/contracts/common";

const SIZES = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-base",
  lg: "size-14 text-md",
  xl: "size-20 text-stat-lg",
  "2xl": "size-24 text-title",
} as const;

/*
 * Initials fallbacks take a quiet tint derived from the name, so a screen of
 * imageless creators reads as a set of distinct people rather than a column
 * of identical grey coins. Tints carry no status meaning: the dedicated
 * decorative tokens plus brand and inferred — never the amber or green the
 * system reserves for measured caution and growth, one cell from genuine
 * badges in the same row.
 */
const TINTS = [
  "bg-sunken text-ink-muted",
  "bg-brand-soft text-brand-ink",
  "bg-inferred-soft text-inferred",
  "bg-tint-slate-soft text-tint-slate",
  "bg-tint-teal-soft text-tint-teal",
] as const;

const MARK_SIZES: Record<keyof typeof SIZES, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
  "2xl": "size-7",
};

function tintOf(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** Rendered edge of each size, in CSS pixels — the Tailwind class above in px. */
const PX: Record<keyof typeof SIZES, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  "2xl": 96,
};

/*
 * Google's avatar CDN encodes the requested square in the path (`=s800-c-k-…`),
 * and the platform hands us whatever size it first wrote — usually 800. Every
 * creator row was therefore decoding an 800px JPEG into a 32px circle: 135 KB
 * each, and on the landing page 807 KB of a 1,098 KB page, for sixteen coins no
 * larger than a thumbnail.
 *
 * Asking for twice the rendered edge covers a 2x display exactly and costs
 * about 10 KB. It is done here rather than at each call site because every
 * avatar in the product goes through this component, and a size the caller has
 * to remember to pass is a size that gets forgotten.
 *
 * Only a `=s<digits>` segment is rewritten, so a CDN that does not use the
 * convention — Instagram's, for one — is passed through untouched.
 *
 * `size` is one of this component's own sizes, or a plain number of CSS
 * pixels for a surface that sizes its own image. The landing page is the
 * reason the second form exists: it renders avatars as raw `<img>` to keep
 * arbitrary CDN hosts out of the optimiser, at edges from a 36px chip to a
 * 320px card, none of which map onto the avatar ladder.
 */
export function avatarSrc(src: string, size: keyof typeof SIZES | number): string {
  const edge = typeof size === "number" ? size : PX[size];
  return src.replace(/=s\d+(?=-|$)/, `=s${edge * 2}`);
}

export function Avatar({
  name,
  src,
  size = "md",
  verification,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  /** Renders the SENSO Verified mark — only ever for `verified`. */
  verification?: VerificationStatus;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {src ? (
        // Remote creator avatars come from arbitrary CDNs; a plain img avoids
        // routing every one of them through the optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc(src, size)}
          alt=""
          loading="lazy"
          decoding="async"
          // Google's avatar CDN refuses hotlinked requests that carry a
          // referrer, and the browser reports it as ERR_BLOCKED_BY_ORB rather
          // than a 403 — so every creator avatar rendered as a broken image.
          referrerPolicy="no-referrer"
          className={cn(
            "rounded-full bg-sunken object-cover ring-2 ring-surface",
            SIZES[size],
          )}
        />
      ) : (
        <span
          aria-hidden
          // Joined rather than cn(): tailwind-merge reads the non-t-shirt size
          // classes (text-stat-lg) as colours and would drop the tint.
          className={`grid place-items-center rounded-full font-display font-bold ${tintOf(name)} ${SIZES[size]}`}
        >
          {initials(name)}
        </span>
      )}
      {verification === "verified" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-surface"
          title="SENSO Verified"
        >
          {/* Scales with the avatar: a fixed 16px mark covered a third of the
              small size and shrank to a speck on the profile header. */}
          <BadgeCheck
            className={cn("text-verified", MARK_SIZES[size])}
            aria-label="SENSO Verified"
          />
        </span>
      )}
    </div>
  );
}
