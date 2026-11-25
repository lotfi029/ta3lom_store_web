# Option D "Glass hero" — public site

Chosen by the owner on 2026-11-25 from three "more liquid" options (D Glass hero, E Frosted everywhere, F Liquid
shapes; options canvas in the project thread). It builds on Option C ([option-c-plan.md](option-c-plan.md)); the
admin is unchanged.

## What changes

| Where | Option C | Option D |
|---|---|---|
| Home top | Indigo banner box + grey quick-donate card | Full-bleed dark hero (`.lhero`) with three drifting blurred blobs (brand, deep brand, gold); the campaign text on a dense glass plate, its cover beside it; quick donate on a light frosted panel (`.glass-panel`) |
| Category tabs | Full-width bar above the hero, tint pill | Floating glass pill bar that overlaps the bottom of the hero; the active tab is a filled brand pill |
| Project card | 3:2 photo, category as a glass chip, title under the photo | 4:3 photo; category and title on a glass plate (`.glass-plate`) over the bottom of the photo |
| Project page | Breadcrumb, photo, tags and title on the page | Dark hero with blobs: breadcrumb, wide cover, and a glass title plate (tags, share, `h1`, summary) over it; a solid sheet with rounded top overlaps the hero |
| Phone donate bar | Light glass pill, brand button | Dark glass pill, gold button |

## Rules kept

- Tokens only: `--c-hero-bg`, `--c-hero-blob-*`, `--c-glass-plate(-edge)`, `--c-glass-panel` in `tokens.css`; the hero is
  permanently dark in both themes.
- Contrast: `scripts/contrast-check.mjs` has a `hero` backdrop set (hero ground + each blob) and checks every text on
  the plate, the panel and the tab bar over it, and the plate over a black or white photo.
- Motion: the blobs animate `transform` only and stop under `prefers-reduced-motion`; the third blob is off on phones.
- Transparency: every new glass falls back to a solid surface without `backdrop-filter` or under
  `prefers-reduced-transparency`.
- One `h1` per route (the banner title, or the hidden store title; the project title on its plate).

## Closer to the mockup (2026-11-25, after the owner's review of v1.2.0)

- **Header in the hero:** on the home and project pages the sticky header starts in the hero's colour, with the
  dark theme's tokens (`.dark-scope`), and the hero fades up into it, so the hero begins under the logo as in the
  mockup. Once the page scrolls (160 px) it turns back into the light glass header.
- **Quick donate:** a dark glass panel (`.dark-scope` + `--c-glass-panel`), as in the mockup.
- **Blobs:** desktops with a pointer (`width >= 1000px` and `hover: hover`) get the mockup's solid, blurred and
  morphing blobs and the frosted card plates. Phones keep the cheaper look: gradient blobs with a dense core, and card
  plates without `backdrop-filter`, because CI Lighthouse runs as a phone without a GPU.
- **Project page on phones:** the cover runs edge to edge (6:7) with the title plate over it.

