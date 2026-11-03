import { ViewportScroller, isPlatformBrowser } from '@angular/common';
import {
  EnvironmentProviders,
  Injectable,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  Scroll,
  UrlSerializer,
} from '@angular/router';

type NavigationTrigger = NonNullable<NavigationStart['navigationTrigger']>;

/**
 * Scrolling after navigation (review 06 F-1). Replaces `scrollPositionRestoration: 'enabled'`, which scrolled to the
 * top on EVERY non-popstate navigation — query-only listing changes included — so a tab, sort or page change jumped
 * to 0,0 and then smooth-scrolled back to the filter bar, and Back lost its restored position to `focusResults`.
 *   - popstate (Back/Forward): restore the saved position; `lastTrigger()` is 'popstate' so pages skip their own focus;
 *   - a fragment: scroll to the anchor;
 *   - same path, only the query changed (`?category=`, `?sort=`, `?page=`): leave the scroll alone — the page decides;
 *   - a new path: top.
 * The router keeps emitting `Scroll` events (positions saved on NavigationStart) with restoration 'disabled'.
 */
@Injectable({ providedIn: 'root' })
export class NavigationScroll {
  private readonly router = inject(Router);
  private readonly serializer = inject(UrlSerializer);
  private readonly scroller = inject(ViewportScroller);
  /** What started the current navigation: 'imperative', 'popstate' or 'hashchange'. */
  readonly lastTrigger = signal<NavigationTrigger>('imperative');
  private prevPath: string | null = null;
  private readonly queryOnly = new Map<number, boolean>();

  install(): void {
    this.scroller.setHistoryScrollRestoration('manual');
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.lastTrigger.set(e.navigationTrigger ?? 'imperative');
      else if (e instanceof NavigationEnd) {
        const path = this.path(e.urlAfterRedirects);
        this.queryOnly.set(e.id, this.prevPath === path);
        this.prevPath = path;
      } else if (e instanceof Scroll) this.onScroll(e);
    });
  }

  private onScroll(e: Scroll): void {
    if (e.scrollBehavior === 'manual') return;
    const id = 'id' in e.routerEvent ? e.routerEvent.id : -1;
    const queryOnly = this.queryOnly.get(id) ?? false;
    this.queryOnly.delete(id);
    if (e.position) this.restore(e.position);
    else if (e.anchor) this.scroller.scrollToAnchor(e.anchor);
    else if (!queryOnly) this.scroller.scrollToPosition([0, 0], { behavior: 'instant' });
  }

  /**
   * Back/Forward: the page may still be loading (shorter than before), so the browser clamps the position. Try again
   * on the next frames until the target is reached, for at most ~1.5 s, or until the visitor scrolls.
   */
  private restore(position: [number, number]): void {
    const w = this.scroller as ViewportScroller;
    const target = position[1];
    let tries = 0;
    let lastSet = -1;
    const step = (): void => {
      const now = w.getScrollPosition()[1];
      if (lastSet >= 0 && Math.abs(now - lastSet) > 2) return; // the visitor scrolled meanwhile
      w.scrollToPosition(position, { behavior: 'instant' });
      lastSet = w.getScrollPosition()[1];
      if (Math.abs(lastSet - target) > 2 && ++tries < 30) setTimeout(step, 50);
    };
    step();
  }

  private path(url: string): string {
    const tree = this.serializer.parse(url);
    tree.queryParams = {};
    tree.fragment = null;
    return this.serializer.serialize(tree);
  }
}

/** Browser only; the prerender never scrolls. */
export function provideNavigationScroll(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (isPlatformBrowser(inject(PLATFORM_ID))) inject(NavigationScroll).install();
  });
}
