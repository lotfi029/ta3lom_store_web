# Store web redesign — Option C "Liquid touch"

**Date:** 2026-11-20 · **Chosen by:** Lotfi (from three options: A Clarity, B Night tide, C Liquid touch)
**Options canvas:** https://claude.ai/artifact/DLkrFJuV7iqqwsPXvE5Mpo · **Full plan:** https://claude.ai/artifact/JeXFTPA51vsG3GQZL5dryd

Option C restyles the store's look; it does not change what the store does. Routes, data, wording, API calls, SEO,
prerendering, cart and payment flows stay as they are. Logo, brand blue, gold, Readex Pro and the `--c-*` semantic layer stay.

## Rules

- **Glass only on chrome that floats over other content:** the sticky store header, the admin top bar, the project donate
  dock, the phone bottom bars, toasts, chips over photos, the text plate on the campaign banner, the admin KPI tiles.
- **Everything read at length stays solid:** cards, forms, tables, project text, cart, checkout.
- **Liquid buttons:** pill radius, a soft top highlight on filled buttons, the existing shine, press and focus ring kept.
- **Shape:** cards 16 → 20 px (`--rc`), large panels 28 px (`--r-xl`).
- **No new colours:** every glass tint is the existing palette at an opacity, defined once in `tokens.css` (`--c-glass*`).

## Tokens and gates

`--c-glass`, `--c-glass-strong`, `--c-glass-edge`, `--c-glass-highlight`, `--c-glass-shadow`, `--c-glass-dark`,
`--c-glass-dark-edge`, `--c-glass-dark-highlight`, `--c-glass-chip`, `--c-on-glass-chip`, `--c-focus-on-glass`,
`--c-liquid-hi`, `--glass-blur`, `--r-xl`. Utilities `.glass`, `.glass-strong`, `.glass-dark`, `.glass-chip` in `base.css`
fall back to solid surfaces without `backdrop-filter` and under `prefers-reduced-transparency`.

`scripts/contrast-check.mjs` composites a translucent background over every backdrop it can float over (page, grey panel,
indigo banner + glow, black and white photo) and keeps the worst ratio. Text on light glass is `--c-text` / `--c-text-2`.

## Phases (one commit each)

1. **Design system:** tokens, glass utilities, liquid button, toast, dialog, pager, contrast gate.
2. **Storefront:** glass header, pill category tabs, banner glass plate, glass chips on project cards and the project hero,
   floating glass donate dock, phone bottom bar (< 600 px), radii and pills on cart / checkout / order / account.
3. **Admin:** glow top bar with glass search and account chip, dashboard greeting + KPIs on a dark band as glass tiles,
   pill active nav item, floating glass phone tab bar, radii and pills on panels, tabs and filters.

## As built (deviations from the canvas)

- Project tags stay under the hero image instead of over it.
- On phones the header keeps its cart and menu buttons beside the new glass bottom bar (e2e and keyboard flows use them);
  the bottom bar hides while the project donate bar shows, so only one floating bar is on screen.
- The admin dark KPI band is on the dashboard only; the admin top bar gets a soft `--c-admin-glow`. Other admin pages keep
  the approved 2026-11-16 structure with the new radii and pill controls.
