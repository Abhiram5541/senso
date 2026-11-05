# Landing page: signal from noise

The November 4 redesign follows the user's cinematic website references. The
previous page's lilac, centered, dashboard-led opening is replaced by an asymmetric
black hero with a violet optical sculpture. The existing SENSO mark, Jakarta/Inter
fonts, violet identity, product data, routes, and business logic remain in place.

The landing-only CSS module owns the new visual treatment. The application and
pricing page keep their existing theme. Product demonstrations reuse the real
React components; dark section tokens are scoped to those sections.

## Page composition

- Cinematic hero: “Beyond reach. Into relevance.”, demo link, exploration link.
- Interactive discovery preview with local search and creator selection.
- Dark comparison of creator health and evidence confidence, kept separate.
- Compact provenance receipt and an editorial AI analysis note.
- Campaign brief, participant group, and a creator-to-posts-to-reach relationship.
- Focused measurement plot beside decision-oriented copy.
- Live database coverage and source pipeline.
- Full-width dark closing statement and footer.

The user rejected the earlier below-fold dashboard dumps. The default view now
uses dedicated marketing compositions in `marketing-story.tsx` and
`marketing-story.module.css`. Full discovery, dossier, provenance, AI and campaign
interfaces remain in native expandable details. No application screen was changed.
On mobile, creator names wrap and the chart begins with readable counts for health
and confidence thresholds. The complete distribution remains expandable.
The explorer filters only the provided preview profiles; it does not consume a
search allowance or call a new API. Watermelon feature-3 informed the focused
preview treatment, adapted with SENSO data and existing components.

## References and asset

The user's first screenshot supplies the dark, fluid-light direction. The second
and third supply generous composition and a dominant visual. Watermelon hero-14
source supplied the starting hero/CTA patterns, adapted to existing LinkButton
and Reveal components without adding Motion or icon dependencies. Mobbin search
was unavailable because the connected account requires a paid plan.

`public/brand/senso-signal.webp` is an original asset made with the built-in image
generation tool, converted from PNG to WebP at quality 88 (85,890 bytes). It is
decorative, contains no product claims, and is not a mockup of the interface.

Generation prompt:

> Create a cinematic abstract 3D light sculpture background for an enterprise influencer intelligence website. Ultra-wide landscape 1536x1024. Near-black background #08080c. A flowing bundle of exceptionally fine polished optical glass ribbons in luminous electric violet, lavender and icy white, entering from the upper center at x=60%, converging into a beautiful narrow twisting loop at x=72% y=44%, then unfurling in sweeping long arcs towards the bottom right edge. Beautiful physically rendered specular reflections, elegant fluid continuous filaments, premium art direction, subtle photographic bloom, high contrast. LEFT 48 PERCENT MUST BE EMPTY pure near black negative space for a large headline, no ribbons over there. Sculptural, optical, precise, dynamic, understated, beautiful. No text, letters, logos, stars, UI, cards, sparkles, particle dust, grids or watermarks. Background image only, not website mockup.

## Local verification

Run `node scripts/verify-landing.mjs` with the local server running. It checks four
widths (390, 768, 1024, 1440), axe contrast/accessibility, page containment, content,
navigation, mobile menu/Escape/focus, the demo CTA, public destination pages,
JavaScript-disabled content, creator selection, search/empty/reset, expanded detail
accessibility, and browser exceptions. Screenshots are saved under
`/tmp/senso-landing-review` by default. No forms are submitted.

The configured local PostgreSQL service was unavailable. The preview uses the
existing development driver through process-level environment overrides; no
environment files were edited. Scheduled jobs and outbound notifications are off.

No deployment, commits, pushes, branch changes, or remote repository writes were
performed.

## Files changed across the landing redesign

- `src/app/(public)/page.tsx`: landing composition; existing data loading retained.
- `src/app/(public)/landing.module.css`: scoped hero, navigation and closing styles.
- `src/components/marketing/marketing-story.tsx`: focused feature sections and expandable original interfaces.
- `src/components/marketing/marketing-story.module.css`: responsive feature layouts.
- `src/components/marketing/creator-explorer.tsx`: local interactive creator preview.
- `src/components/marketing/marketing-menu.tsx`: accessible mobile navigation.
- `src/components/marketing/product-surfaces.tsx`: keyboard-accessible table scroll regions.
- `src/components/shell/marketing-chrome.tsx`: optional landing navigation treatment.
- `public/brand/senso-signal.webp`: decorative hero artwork.
- `scripts/verify-landing.mjs`: read-only browser regression checks.
- `docs/landing-redesign.md`: design and verification record.

Final validation: production build, TypeScript check and lint passed. Browser
checks passed at all four widths, including expanded detail views, with no axe
violations or browser exceptions. Screenshot review confirmed the revised
campaign hierarchy and mobile readability. These checks do not exercise backend
transactions or submit forms against the unavailable PostgreSQL service.
