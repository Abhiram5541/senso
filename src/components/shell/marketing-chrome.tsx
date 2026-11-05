import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/class-names";
import { Wordmark } from "@/components/shell/logo";

/*
 * The homepage is written for marketers, agencies and the people who sign the
 * budget. Developer API moved onto /pricing, beside the plan that includes it,
 * because a nav slot spent on integrators is a slot the buyer does not use.
 */
const NAV = [
  { href: "/#creators", label: "Creators" },
  { href: "/#how", label: "How it works" },
  { href: "/#evidence", label: "Evidence" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Shared chrome for the marketing pages (CLAUDE.md D51). Sign-in pages opt
 * out of it.
 *
 * The header is a floating pill rather than a full-width bar: it sits over
 * the page instead of cutting a band across the top of it, which is what
 * lets the hero's headline run to the edge of the first screen.
 */
export function MarketingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk flex min-h-dvh flex-col bg-surface text-ink">
      <a
        href="#main"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-full bg-brand px-4 py-2 text-base font-semibold text-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 rounded-full bg-surface/80 pl-4 pr-2 shadow-popover backdrop-blur-xl sm:pl-5">
          <Link href="/" className="rounded-full" aria-label="SENSO home">
            <Wordmark className="[&_.label-caps-sm]:hidden" />
          </Link>
          {/* From lg: at 768px the wordmark, four links and two actions need
              more than the row has, and the page must never scroll sideways. */}
          <nav aria-label="Main" className="mx-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="press rounded-full px-3.5 py-2 text-base font-medium text-ink-muted hover:bg-sunken hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <Link
              href="/login"
              className="press whitespace-nowrap rounded-full px-3.5 py-2 text-base font-semibold text-ink-muted hover:bg-sunken hover:text-ink"
            >
              Sign in
            </Link>
            <CtaPill href="/register" size="sm">
              {/* The full label does not fit beside the wordmark and Sign in
                  at 375px, and the page must never scroll sideways. */}
              <span className="sm:hidden">Demo</span>
              <span className="hidden sm:inline">Request a demo</span>
            </CtaPill>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="overflow-hidden bg-surface">
        <div className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
          <div className="flex flex-col gap-12 border-t border-line pt-12 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm space-y-4">
              <Wordmark />
              <p className="text-base leading-6 text-ink-muted">
                Influencer intelligence built on official platform APIs, authorized creator
                connections and permitted public research.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-14 gap-y-6 text-base sm:grid-cols-3">
              <FooterGroup
                title="Platform"
                links={[
                  { href: "/#creators", label: "Creators" },
                  { href: "/#evidence", label: "Data provenance" },
                  { href: "/#intelligence", label: "AI intelligence" },
                  { href: "/pricing#api", label: "Developer API" },
                ]}
              />
              <FooterGroup
                title="Company"
                links={[
                  { href: "/pricing", label: "Pricing" },
                  { href: "/login", label: "Sign in" },
                  { href: "/register", label: "Request a demo" },
                ]}
              />
              <FooterGroup
                title="Legal"
                links={[
                  { href: "/privacy", label: "Privacy" },
                  { href: "/terms", label: "Terms" },
                ]}
              />
            </div>
          </div>
          <p className="mt-12 max-w-3xl text-sm leading-5 text-ink-subtle">
            © {new Date().getFullYear()} SENSO. Data is collected from official platform APIs
            and authorized connections. Estimated and AI-inferred values are labelled as such
            throughout the product. Creators and coverage on the homepage are read live from
            the database; the campaign and AI examples are illustrative.
          </p>
        </div>
        {/* The wordmark set at page width, cropped by the page's foot — the
            closing gesture of an editorial layout. Decorative: the real
            wordmark and name are above. */}
        <p
          aria-hidden
          className="mt-10 select-none text-center font-display text-[clamp(7rem,34vw,34rem)] font-semibold leading-[0.7] tracking-[-0.07em] text-sunken-strong"
        >
          senso
        </p>
      </footer>
    </div>
  );
}

/**
 * The marketing call to action: an ink pill ending in an orange coin that
 * carries the arrow. The coin is the one place on the pill the orange sits,
 * so the label stays ink-on-white contrast at every size.
 */
export function CtaPill({
  href,
  children,
  size = "md",
  className,
}: {
  href: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "press group inline-flex items-center whitespace-nowrap rounded-full bg-ink font-semibold text-ink-inverse hover:bg-instrument-raised",
        size === "sm" && "h-10 gap-2.5 pl-4 pr-1 text-base",
        size === "md" && "h-12 gap-3 pl-5 pr-1.5 text-md",
        size === "lg" && "h-14 gap-3.5 pl-6 pr-1.5 text-md",
        className,
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-full bg-brand text-ink transition-transform group-hover:rotate-45",
          size === "sm" ? "size-8" : size === "md" ? "size-9" : "size-11",
        )}
      >
        <ArrowUpRight className={size === "sm" ? "size-4" : "size-[1.125rem]"} />
      </span>
    </Link>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="rounded text-ink-muted hover:text-ink hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
