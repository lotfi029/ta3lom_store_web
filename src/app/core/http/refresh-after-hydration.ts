import { ApplicationRef, afterNextRender, inject } from '@angular/core';

/** Anything with a `reload()` — every `HttpResourceRef` qualifies. Typed narrowly on purpose so
 *  this has no dependency on `@angular/common/http`'s resource types. */
interface Reloadable {
  reload(): boolean;
}

/**
 * Forces every given resource to refetch once, right after this component's first render.
 *
 * `provideClientHydration()`'s default HTTP transfer cache is what makes the prerendered page's
 * first paint instant AND correct — the response for every request made during prerendering is
 * embedded in `<script id="ng-state">`, and hydration replays it instead of hitting the network.
 * That is exactly right for a request made and consumed within one server render.
 *
 * It is exactly wrong here: this site is PRERENDERED AT BUILD TIME (ADR-002), so the embedded
 * response is not "a moment ago", it is "as of the last deploy". Left alone, a visitor who lands
 * on a route whose data the build captured never sees anything published since — the cache is
 * permanent, not momentary. (The failure is invisible per-request: a different query string on
 * the same page, e.g. `/videos?size=100` vs the home page's `/videos?size=5`, is a cache MISS and
 * fetches live, which is why the same new item can appear on one route and not another.)
 *
 * The fix is not to disable the cache — the prerendered content is the only thing on screen at
 * hydration, so throwing it away would blank the page while the same data re-fetches. Instead,
 * `reload()` it once: `httpResource` keeps its previous (cached) value while a reload is in
 * flight, so nothing disappears — the view simply becomes current a moment after paint, with no
 * flash for the common case where nothing actually changed.
 *
 * The reload must wait until the application is STABLE: until then the transfer cache still answers every matching
 * GET from the embedded state, so a reload fired right after the first render was served the build-time response
 * again and never reached the network (found by the R5 e2e: archived projects stayed on the prerendered home).
 *
 * Call this from a constructor (component or root service) — it needs an injection context.
 */
export function refreshAfterHydration(...resources: Reloadable[]): void {
  const app = inject(ApplicationRef);
  afterNextRender(() => {
    void app.whenStable().then(() => {
      for (const resource of resources) resource.reload();
    });
  });
}
