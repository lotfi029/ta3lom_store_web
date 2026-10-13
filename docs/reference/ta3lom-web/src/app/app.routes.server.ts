import { RenderMode, ServerRoute } from '@angular/ssr';
import { PROGRAM_SLUGS, NEWS_SLUGS, ARTICLE_SLUGS, VIDEO_IDS, PARTNER_IDS, LEADER_IDS } from './prerender-manifest';

/**
 * Part 0 (Session 2): these three routes used to independently `fetch()` the API for the same
 * slugs `scripts/routes.mjs` already fetches to build sitemap.xml — two sources of truth that
 * could drift (docs/architecture/02-routing-and-rendering.md:199). They now import the generated
 * manifest instead; `routes.mjs` (run as the `prebuild` npm script) is the one place slugs are
 * fetched from the API. See prerender-manifest.ts's own header comment.
 */
export const serverRoutes: ServerRoute[] = [
  // Session 2, Part 1: the whole admin tree is client-rendered, never prerendered — it is
  // guarded by authGuard (which calls AuthService.silentRefresh(), a network call that must
  // never run at build time), and its content is neither public nor meant to be crawled
  // (see SeoService.setAdminTitle()'s noindex). This MUST come before the trailing `**` rule:
  // ServerRoute patterns are matched in array order, same as the Angular Router itself, so a
  // later `admin/**` entry would never be reached once `**` had already claimed the path.
  { path: 'admin/**', renderMode: RenderMode.Client },
  {
    path: 'programs/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return PROGRAM_SLUGS.map((slug) => ({ slug }));
    },
  },
  {
    path: 'media/news/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return NEWS_SLUGS.map((slug) => ({ slug }));
    },
  },
  {
    path: 'media/articles/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return ARTICLE_SLUGS.map((slug) => ({ slug }));
    },
  },
  // Keyed on the video's UUID, not a slug — videos are the one public detail route the API does
  // not give a slug. Without this entry the build fails outright ("route uses prerendering and
  // includes parameters, but getPrerenderParams is missing"), because the `**` rule below claims
  // videos/:id and prerendering cannot expand a parameter it has no values for.
  {
    path: 'videos/:id',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return VIDEO_IDS.map((id) => ({ id }));
    },
  },
  // Partners are keyed on their uuid for the same reason videos are — no slug on the model.
  {
    path: 'partners/:id',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return PARTNER_IDS.map((id) => ({ id }));
    },
  },
  // Leadership members, likewise — the profile page at /about/leadership/:id.
  {
    path: 'about/leadership/:id',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return LEADER_IDS.map((id) => ({ id }));
    },
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
