import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { GiftCategories } from '../../core/ui/gift-categories.data';
import { QuickDonate } from '../../core/ui/quick-donate.service';
import { Icon } from '../../shared/ui/icon/icon';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { SkipLink } from '../skip-link/skip-link';

/** Storefront and account chrome. The admin has its own shell (W-08), outside this layout. */
@Component({
  selector: 'ta-public-layout',
  imports: [RouterOutlet, SkipLink, Header, Footer, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-skip-link />
    <ta-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <!-- F6.3: prerendered, hydrated when it scrolls into view or is used (event replay keeps early clicks). -->
    @defer (hydrate on viewport; hydrate on interaction) {
      <ta-footer />
    }
    @if (browsing() && quick.available()) {
      <button
        type="button"
        class="side-quick"
        (click)="quick.show($event.currentTarget)"
        aria-label="تبرع سريع"
        i18n-aria-label="@@store.quick.title"
      >
        <ta-icon name="gift" [size]="22" />
      </button>
    }
    <!-- Back to top: after two screens of scrolling; focus returns to the start of the page content. -->
    <button
      type="button"
      class="to-top"
      [class.show]="farDown()"
      [attr.inert]="farDown() ? null : ''"
      (click)="toTop()"
      aria-label="العودة إلى الأعلى"
      i18n-aria-label="@@store.layout.back-to-top"
    >
      <ta-icon name="chevron" [size]="20" class="up" />
    </button>
  `,
  styles: `
    main {
      display: block;
      min-block-size: 60vh;
    }
    main:focus {
      outline: none;
    }
    /*
     * The floating quick-donate button (reference site), on the reading-end edge. Only where the page has a margin
     * outside the 1200 px content column (>= 1320 px), so it never covers a link or a control (WCAG 2.5.8); smaller
     * screens use the header button (or the menu and the home hero on phones).
     */
    .side-quick {
      /* Hidden below 1320 px: a second display: grid in this rule used to override it, so the button covered card
         controls on phones and tablets. */
      display: none;
      position: fixed;
      inset-inline-end: 4px;
      inset-block-end: 20px;
      z-index: 40;
      inline-size: 52px;
      block-size: 52px;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: var(--c-brand-strong);
      color: var(--c-on-brand);
      box-shadow: 0 10px 30px var(--c-header-shadow);
      cursor: pointer;
    }
    @media (width >= 1320px) {
      .side-quick {
        display: grid;
      }
    }
    .to-top {
      position: fixed;
      inset-inline-start: var(--space-4);
      /* Above the project page's sticky donate bar while it shows (--dbar-h, set by project.page.ts). */
      inset-block-end: calc(var(--space-5) + var(--dbar-h, 0px));
      z-index: 44;
      inline-size: 48px;
      block-size: 48px;
      display: grid;
      place-items: center;
      border: 1px solid var(--c-border);
      border-radius: 50%;
      background: var(--c-surface);
      color: var(--c-text);
      box-shadow: 0 10px 30px var(--c-header-shadow);
      cursor: pointer;
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
      transition:
        opacity var(--dur-2) var(--ease),
        transform var(--dur-2) var(--ease),
        inset-block-end var(--dur-2) var(--ease);
    }
    .to-top.show {
      opacity: 1;
      transform: none;
      pointer-events: auto;
    }
    .to-top:hover {
      border-color: var(--c-text);
    }
    .to-top .up {
      transform: rotate(-90deg);
    }
    /* The chevron mirrors in RTL (icon DIRECTIONAL), so it turns the other way to point up. */
    :host-context([dir='rtl']) .to-top .up {
      transform: rotate(90deg);
    }
    @media (prefers-reduced-motion: reduce) {
      .to-top {
        transition: none;
      }
    }
  `,
})
export class PublicLayout {
  protected readonly quick = inject(QuickDonate);
  private readonly doc = inject(DOCUMENT);
  /** More than two screens down: the back-to-top button shows. */
  protected readonly farDown = signal(false);

  @HostListener('window:scroll')
  protected onScroll(): void {
    const w = this.doc.defaultView;
    if (w) this.farDown.set(w.scrollY > w.innerHeight * 2);
  }

  protected toTop(): void {
    const w = this.doc.defaultView;
    if (!w) return;
    const reduce = w.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    w.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' });
    this.doc.getElementById('main')?.focus({ preventScroll: true });
  }
  constructor() {
    inject(GiftCategories).start(); // F-5: the gift-category count, once, after the first render
  }
  private readonly router = inject(Router);
  /** The floating button shows while browsing (home/listing, project pages) — never over cart, checkout or forms. */
  protected readonly browsing = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => isBrowsing(this.router.url)),
    ),
    { initialValue: isBrowsing(this.router.url) },
  );
}

/** Home/listing (`/`, `/?…`, `/#…`) and project pages (`/p/…`). */
export function isBrowsing(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path === '/' || path === '' || path.startsWith('/p/');
}
