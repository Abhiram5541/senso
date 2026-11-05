---
name: SENSO
description: Editorial and measured — white paper, one charcoal slab, one orange spent on intent, large light Urbanist headlines over Inter figures.
colors:
  ground: "#e9e9e7"
  canvas: "#f6f6f5"
  surface: "#ffffff"
  sunken: "#f2f2f1"
  sunken-strong: "#e7e7e5"
  line: "#e6e6e4"
  line-strong: "#d3d3d0"
  rule: "#efefed"
  ink: "#111111"
  ink-muted: "#4a4a48"
  ink-subtle: "#646461"
  ink-inverse: "#f7f7f5"
  instrument: "#141414"
  instrument-deep: "#0b0b0b"
  instrument-raised: "#202020"
  instrument-line: "#2b2b2b"
  instrument-ink: "#f5f5f4"
  instrument-muted: "#a8a8a5"
  brand: "#ff4f1f"
  brand-active: "#e8400f"
  brand-soft: "#ffe8df"
  brand-ink: "#c2340c"
  brand-lift: "#ff7a52"
  positive: "#167243"
  caution: "#a1600a"
  critical: "#c4304a"
  verified: "#2b62d9"
  inferred: "#0e7490"
  series-1: "#ff4f1f"
  series-2: "#1d6a7a"
  series-3: "#5b5bd6"
typography:
  display:
    fontFamily: "Urbanist, Inter, ui-sans-serif, sans-serif"
    fontSize: "clamp(3.25rem, 1.4rem + 7.4vw, 9rem)"
    fontWeight: 500
    lineHeight: 0.94
    letterSpacing: "-0.045em"
  display-sm:
    fontFamily: "Urbanist, Inter, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.25rem, 1.3rem + 3.6vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.045em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.375rem"
  numeric:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontFeatureSettings: "tnum"
rounded:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  "2xl": "36px"
  "3xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-inverse}"
    rounded: "9999px"
  button-accent:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.ink}"
    rounded: "9999px"
  cta-pill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-inverse}"
    trailingCoin: "{colors.brand}"
  slab:
    backgroundColor: "{colors.instrument}"
    rounded: "48px"
---

# Design System: SENSO

The tokens live in `src/app/globals.css` (`@theme`) and nowhere else. This document
explains them; CLAUDE.md D51 records why they changed.

## Overview

SENSO is an instrument for deciding whether a number can be trusted before money is spent
on it, sold to marketing teams. The visual language is **editorial**: white paper, large
and light headlines, one charcoal slab and one orange, the way a well-set magazine spread
spends its one dark page and its one colour.

Three rules decide almost every open question:

1. **Scarcity is the accent's meaning.** Orange marks intent — the active route, focus,
   the score arc, icon coins, the CTA's arrow coin. It is a *fill*, not a text colour:
   white on it clears AA only at display size, so small text on orange is ink, and
   orange text on white is `brand-ink`.
2. **Absence is drawn, never filled.** A component nobody could measure gets a hatched
   track, not an empty bar; a risk with no signal reads `unknown`, not `low`.
   Manufacturing a figure to avoid an empty state is the one unrecoverable failure.
3. **Composition before ornament.** Bands and splits before objects. One charcoal slab
   per screen.

## Colors

**Paper.** `canvas` #f6f6f5 is the application ground; `surface` #ffffff is a card and
the marketing page. `sunken` #f2f2f1 is apparatus and the marketing site's soft tiles.

**Charcoal.** `instrument` #141414 is the one dark material — the creator showcase slab
on the landing page, the score card, the sign-in panel. A panel on it is `.slab-card`
(a translucent lift with an inset highlight), never a bordered box.

**Orange.** `brand` #ff4f1f for fills, `brand-ink` #c2340c for text on white (5.5:1),
`brand-lift` #ff7a52 on charcoal (7.1:1). The primary *button* is ink, not orange: an
orange primary would carry 14px white text below AA and would spend the accent on every
screen.

**Measurement colour.** Emerald = growth, amber = caution, rose = risk, blue = verified,
teal = AI-inferred. These apply to data and never to chrome. Chart series are orange,
deep teal, indigo — three is the ceiling.

## Typography

**Urbanist** sets headings: large, weight 500, tracked −0.045em at display size. The
landing page reads in it throughout (`.mk`).

**Inter** sets interface text and **every numeral** (`.font-num`, tabular figures).
Urbanist's digits are proportional, so a metric column set in it would not align.

## Layout

Rail 248px, collapsing to a 68px icon rail (remembered per user), becoming a
drawer below `lg`. Topbar 56px, sticky, and carrying only what every route
shares — the command palette, remaining search allowance, help, notifications. Identity
and account live in the rail, which is what frees the topbar from being a second row of
chrome.

Page structure, in increasing weight:

- `PageHeader` — sits directly on the canvas, no slab. Breadcrumb, title in the display
  voice, optional lead figure in the numeric voice, description at `measure`.
- `Instrument` — the charcoal card carrying the screen's single headline reading. **At
  most one per screen**; two and neither is the headline.
- `Section` / `PageBand` — a full-bleed white band separated by a rule. Structure without
  a box, and the default for most groupings.
- `Split` — two or three columns sharing one hairline instead of a gutter between cards.
- `Panel` — a genuine object: a chart, a queue, a dossier block.

Inside any container, rows and columns separate with `rule` #edeae5, which is lighter than
the container's own edge: structure inside a container must never compete with the
container.

Responsive means a different hierarchy, not a shrunk desktop. Tables become cards or gain
their own horizontal scroll container — the page body never scrolls sideways. Filters
become a sheet. The rail becomes a drawer that is the rail, in the same material.

## Elevation & Depth

**Declared once per element: a border or a shadow, never both.** A 1px border under a wide
soft shadow is the ghost card. The shadow tokens therefore carry their own hairline as
their first layer, so an overlay stays defined against white without a second declaration.

- `raised` — a hair off the page. Table chips, small controls.
- `lifted` — hover state for a clickable card.
- `popover` / `overlay` — things that genuinely float: menus, dialogs, sheets.
- `instrument` — the score readout, floated off the canvas.
- `chrome-raised` — the inset top highlight that lifts a surface *inside* the charcoal.

Rows tint on hover. Clickable cards lift 2px. Static cards do not move at all.

## Shapes

Radius rises with the size of the thing: 6px micro-tag, 10px input, 12px menu item,
20px tile, 28px card, 36px feature card, 48px slab and shell. One radius everywhere is
the tell of a system that picked a number instead of making a decision. Buttons, tabs and
segmented controls are pills; the marketing site's photo cards are 32px.

The recurring geometric device is the **orbit**: the arc the mark is built from, drawn at
page scale behind the marketing hero and the sign-in panel, and drawn as graduations
around the score dial. It is geometry the session can specify exactly — never an
illustration, never a texture.

## Components

**Score dial** (`ScoreRing`). The product's signature artifact. A brass tick ring engraved
around an orange arc, the value set in the numeric voice at 33% of the dial's diameter, the
unit below in caps. The arc sweeps from empty once on mount and never again; under
reduced motion the inline dash offset is what renders, so the value is never lost. The
tick ring is suppressed below 80px, where it would collapse into a grey smudge.

**Instrument** (`Instrument`). A rounded charcoal card carrying the screen's one headline
reading — the roster's median health, a campaign's performance score. Top edge lit by a
hairline of white at 8%.

**Metric strip** (`MetricStrip` / `Metric`). One continuous strip divided by rules, never
a tray of separate tiles. The strip must divide evenly: `React.Children.toArray` is what
counts its cells, because `Children.count` counts the `false` a conditional child leaves
behind and silently picks the wrong column count.

**Score bar** (`ScoreBar`). A measured zero gets a visible sliver; an unmeasured component
gets a hatched track. Empty reads as "a bar that failed to render"; hatched reads as
"there is nothing to draw here", and those mean opposite things.

**Provenance** (`TrackedValue`). A figure with a dotted rule under it; clicking opens a
panel naming the method, source tier, collection time, derivation formula, model and
prompt version where AI was involved, and field confidence. A click-through, not a
tooltip: a tooltip cannot be reached on touch, cannot be read at leisure and cannot hold
a source link.

**Buttons.** Ink primary, orange accent with ink text, the marketing `CtaPill` (ink with an orange arrow coin), outlined secondary, ghost,
rose danger, link. Heights 32/36/44. `loading` shows a spinner, disables the control and
holds its width.

**Table.** A real `<table>`, 12px horizontal and 10px vertical cell padding, caps headers,
rules between rows, hover tint, `brand-softer` for the selected row. The wrapper is the
horizontal scroll container and is keyboard focusable.

**Reveal** (`Reveal`). One entrance recipe for the whole marketing site: rise 14px, unblur
6px, settle over 700ms on an exponential ease-out, once. Built on IntersectionObserver
plus one CSS class — a scroll-animation library would be the largest thing on a page whose
argument is that the product is measured rather than decorated. Scroll itself is left
alone for the same reason.

## Do's and Don'ts

**Do**

- Put the screen's one headline reading on the instrument band, and let everything else
  be quiet.
- Set every figure in the numeric voice, including chart axis labels.
- Show the range a number was drawn from, not just the number.
- Render absence explicitly: hatched tracks, `unknown` bands, building-history states,
  withheld percentiles below a cohort of eight.
- Theme the browser's own surfaces — selection, caret, scrollbars, focus rings,
  underline offset. It is the cheapest signal that a page was built rather than assembled.
- Give every screen its loading, empty, error and partial-data states.

**Don't**

- Don't put a caps kicker above a heading. Wayfinding belongs in the breadcrumb; the
  heading carries its own weight.
- Don't set small white text on orange, and don't spend orange on an ordinary toolbar button.
  The landing page's closing block is the one large orange fill.
- Don't put brass on anything that is not a measurement.
- Don't nest cards, and don't use a row of same-size icon-heading-text cards as a page
  structure.
- Don't declare a border and a shadow on the same element.
- Don't add a second instrument band to a screen.
- Don't animate more than one authored moment per screen, and never re-animate a reveal
  on the way back up.
- Don't use a gradient for text, glass as decoration, a coloured `border-left` above 1px,
  or a `feTurbulence` grain overlay.
- Don't show a period-over-period delta on an org-level figure. The database holds four
  snapshot days for 627 of 631 creators; manufacturing a comparison on the dashboard of a
  provenance product is the most self-defeating thing this codebase could do.
