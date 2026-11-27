import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StoreAuth } from '../../core/auth/store-auth';
import { CartSummary } from '../../core/cart/cart-summary';
import { QuickDonate } from '../../core/ui/quick-donate.service';
import { I18nService } from '../../core/i18n/i18n';
import { formatMoney } from '../../core/money/money-format';
import { SHOWCASE } from '../../core/showcase/showcase';
import { Icon } from '../../shared/ui/icon/icon';
import { Money } from '../../shared/ui/money/money';
import { AccountMenu } from '../account-menu/account-menu';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { LangSwitch } from '../lang-switch/lang-switch';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

/**
 * Store header, Option C "المتجر أولاً" (docs/r5/home-option-c-spec.md §3 rows 1–2): a dark utility row (receipt and
 * licence text, main site, language), then logo, the big pill search (→ `/{locale}/?q=`, an empty q dropped), quick
 * donate (hidden when no category takes general gifts, M-4), account menu or sign-in, the cart button "السلة · total"
 * (M-2: total from `/cart/summary`, the line count in its accessible name; the bump kept), theme toggle and the mobile
 * drawer. The category tab bar sits under it on the home page (features/store/home/category-tabs).
 * After the first render (browser only) it restores the customer session and loads the cart badge.
 */
/**
 * Hide-on-scroll for narrow screens: away after scrolling down past the first 160 px, back on any upward scroll of
 * 6 px or more. Never away near the top, on wide screens, with the menu open or while focus is inside the header.
 */
export function nextAway(
  away: boolean,
  lastY: number,
  y: number,
  ctx: { narrow: boolean; menuOpen: boolean; focusInside: boolean },
): boolean {
  if (!ctx.narrow || ctx.menuOpen || ctx.focusInside || y < 160) return false;
  if (y > lastY + 6) return true;
  if (y < lastY - 6) return false;
  return away;
}

@Component({
  selector: 'ta-header',
  imports: [RouterLink, Icon, BottomNav, Money, AccountMenu, LangSwitch, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly auth = inject(StoreAuth);
  protected readonly cart = inject(CartSummary);
  protected readonly quick = inject(QuickDonate);
  /** Showcase mode (SW-2): no cart, sign-in or account entries and no session restore / cart read. */
  protected readonly showcase = inject(SHOWCASE);
  private readonly router = inject(Router);
  private readonly locale = inject(I18nService).locale;
  protected readonly mainSite = environment.mainSiteUrl;

  protected readonly scrolled = signal(false);
  /** Phones and small tablets: the header slides away while scrolling down and comes back on any scroll up. */
  protected readonly away = signal(false);
  private lastY = 0;
  protected readonly mobileOpen = signal(false);
  protected readonly bump = signal(false);
  private readonly burger = viewChild<ElementRef<HTMLButtonElement>>('burger');
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /**
   * Option D "Glass hero": on the home and project pages the header starts as dark glass that continues the hero
   * under it (`.dark-scope` re-points its tokens to the checked dark pairs); once the page scrolls past the top of
   * the hero it turns back into the light glass header. Decided from the URL, so the prerendered page has it.
   */
  protected readonly heroRoute = computed(() => {
    const seg = this.router.parseUrl(this.url()).root.children['primary']?.segments ?? [];
    return seg.length === 0 || (seg.length === 2 && seg[0].path === 'p');
  });
  protected readonly nearTop = signal(true);
  protected readonly heroMode = computed(() => this.heroRoute() && this.nearTop());
  /** The search box shows the listing's current `?q=` on the home page. */
  protected readonly currentQ = computed(() => {
    const tree = this.router.parseUrl(this.url());
    const onHome = (tree.root.children['primary']?.segments.length ?? 0) === 0;
    return onHome ? (tree.queryParams['q'] ?? '') : '';
  });

  constructor() {
    afterNextRender(() => {
      if (!this.showcase) void this.auth.ensureSession().then(() => this.cart.load());
    });
    let last = this.cart.bumps();
    effect((onCleanup) => {
      const n = this.cart.bumps();
      if (n === last) return;
      last = n;
      this.bump.set(true);
      const t = setTimeout(() => this.bump.set(false), 500);
      onCleanup(() => clearTimeout(t));
    });
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    const y = window.scrollY;
    this.scrolled.set(y > 8);
    // A dead zone between 120 and 160 px keeps the look until the page clearly leaves or reaches the top, so small
    // scroll movements around one line cannot flip it back and forth.
    if (y < 120) this.nearTop.set(true);
    else if (y >= 160) this.nearTop.set(false);
    this.away.set(
      nextAway(this.away(), this.lastY, y, {
        narrow: window.matchMedia('(width < 900px)').matches,
        menuOpen: this.mobileOpen(),
        focusInside: !!document.activeElement?.closest('.hdr'),
      }),
    );
    this.lastY = y;
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    this.burger()?.nativeElement.focus();
  }

  /** The phone bottom bar's menu button: bring the header back into view and toggle today's drawer. */
  protected openMenuFromBar(): void {
    this.away.set(false);
    this.mobileOpen.set(!this.mobileOpen());
  }

  protected search(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    const q = input.value.trim();
    this.mobileOpen.set(false);
    // Spec (home-option-c §5): search everything — drop the category and the page, keep only the sort (review 06 L-9).
    const tree = this.router.parseUrl(this.url());
    const onHome = (tree.root.children['primary']?.segments.length ?? 0) === 0;
    const sort = onHome ? (tree.queryParams['sort'] as string | undefined) : undefined;
    void this.router.navigate(['/'], {
      queryParams: { q: q || null, sort: sort || null },
    });
  }

  protected cartLabel(): string {
    const n = this.cart.count();
    if (n === 0) return $localize`:@@store.layout.cart-label-empty:سلة التبرعات فارغة`;
    const total = formatMoney(this.cart.total(), this.locale);
    return $localize`:@@store.layout.cart-label-c:سلة التبرعات، ${n}:count: تبرع، الإجمالي ${total}:total:`;
  }
}
