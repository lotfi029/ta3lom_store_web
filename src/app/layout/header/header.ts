import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { StoreAuth } from '../../core/auth/store-auth';
import { CartSummary } from '../../core/cart/cart-summary';
import { Icon } from '../../shared/ui/icon/icon';
import { AccountMenu } from '../account-menu/account-menu';
import { LangSwitch } from '../lang-switch/lang-switch';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

/**
 * Store header (prototype `.hdr`): logo → ta3lom.sa, store nav (home, projects), search (→ the home listing's `?q=`),
 * cart badge (line count, C-2) with bump, account menu or sign-in, language switch keeping the path, theme toggle,
 * mobile drawer.
 * After the first render (browser only) it restores the customer session and loads the cart badge.
 */
@Component({
  selector: 'ta-header',
  imports: [RouterLink, RouterLinkActive, Icon, AccountMenu, LangSwitch, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly auth = inject(StoreAuth);
  protected readonly cart = inject(CartSummary);
  private readonly router = inject(Router);
  protected readonly mainSite = environment.mainSiteUrl;

  protected readonly scrolled = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly bump = signal(false);
  private readonly burger = viewChild<ElementRef<HTMLButtonElement>>('burger');

  constructor() {
    afterNextRender(() => {
      void this.auth.ensureSession().then(() => this.cart.load());
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
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    this.burger()?.nativeElement.focus();
  }

  protected search(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    const q = input.value.trim();
    this.mobileOpen.set(false);
    void this.router.navigate(['/'], { queryParams: q ? { q } : {}, fragment: 'projects' });
  }

  protected cartLabel(): string {
    const n = this.cart.count();
    return $localize`:@@store.layout.cart-label-r5:سلة التبرعات، ${n}:count: تبرع`;
  }
}
