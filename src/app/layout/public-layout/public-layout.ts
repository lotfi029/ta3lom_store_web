import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
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
    <ta-footer />
    @if (browsing()) {
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
      display: none;
      position: fixed;
      inset-inline-end: 4px;
      inset-block-end: 20px;
      z-index: 40;
      inline-size: 52px;
      block-size: 52px;
      display: grid;
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
  `,
})
export class PublicLayout {
  protected readonly quick = inject(QuickDonate);
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
