import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { problemMessage } from '../../core/api/problem-message';
import { toProblem } from '../../core/api/problem';
import { StoreAuth } from '../../core/auth/store-auth';
import { CartSummary } from '../../core/cart/cart-summary';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Signed-in customer menu — a disclosure (button + list of links), not an ARIA menu: every item is a plain link or
 * button reachable with Tab. Escape and an outside click close it and return focus to the button.
 */
@Component({
  selector: 'ta-account-menu',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="acc-menu">
      <button
        #toggle
        type="button"
        class="acc-btn"
        [attr.aria-expanded]="open()"
        aria-controls="account-menu-list"
        (click)="open.set(!open())"
      >
        <ta-icon name="user" [size]="19" />
        <span class="lbl" i18n="@@store.layout.account">حسابي</span>
      </button>
      @if (open()) {
        <ul id="account-menu-list" class="acc-list">
          @if (auth.customer(); as c) {
            <li class="who">
              @if (c.fullName) {
                <b>{{ c.fullName }}</b>
              } @else {
                <b i18n="@@store.layout.donor">متبرع</b>
              }
              <bdi dir="ltr" class="mono">{{ c.mobile }}</bdi>
            </li>
          }
          <li>
            <a routerLink="/account/donations" (click)="close()" i18n="@@store.layout.my-donations"
              >تبرعاتي</a
            >
          </li>
          <li>
            <a routerLink="/account/profile" (click)="close()" i18n="@@store.layout.my-profile"
              >الملف الشخصي</a
            >
          </li>
          <li>
            <button type="button" (click)="signOutEverywhere()">
              <ta-icon name="logout" [size]="18" /><span i18n="@@store.layout.sign-out-all"
                >الخروج من كل الأجهزة</span
              >
            </button>
          </li>
          <li>
            <button type="button" (click)="signOut()">
              <ta-icon name="logout" [size]="18" /><span i18n="@@store.layout.sign-out"
                >تسجيل الخروج</span
              >
            </button>
          </li>
        </ul>
      }
    </div>
  `,
  styleUrl: './account-menu.css',
})
export class AccountMenu {
  protected readonly auth = inject(StoreAuth);
  private readonly cart = inject(CartSummary);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');
  protected readonly open = signal(false);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.toggle()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }

  protected close(): void {
    this.open.set(false);
  }

  /** Revokes every session of the customer (all devices). On failure this device is still signed out; the donor is told. */
  protected async signOutEverywhere(): Promise<void> {
    this.open.set(false);
    try {
      await this.auth.logoutAll();
    } catch (e) {
      this.toast.show(problemMessage(toProblem(e)), 'error');
    } finally {
      await this.cart.load();
      await this.router.navigateByUrl('/');
    }
  }

  protected async signOut(): Promise<void> {
    this.open.set(false);
    try {
      await this.auth.logout();
    } finally {
      await this.cart.load();
      await this.router.navigateByUrl('/');
    }
  }
}
