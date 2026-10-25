import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Cart, CartProblem } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StoreConfig } from '../../../core/api/store-config';
import { StoreAuth } from '../../../core/auth/store-auth';
import { cartNoticeText } from '../../../core/cart/cart-notice-text';
import { CartStore } from '../../../core/cart/cart-store';
import { CartSummary } from '../../../core/cart/cart-summary';
import { EMAIL } from '../../../core/forms/patterns';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { environment } from '../../../../environments/environment';
import { lineProblem } from '../cart/line-problems';
import type { CheckoutNavState } from '../donate/donate-box';
import { OtpSignIn } from '../login/otp-sign-in';
import { OrderTokenStore } from '../order/order.data';
import { CheckoutData } from './checkout.data';

/**
 * `/checkout` (W-M3): (1) inline OTP sign-in when signed out — the guest cart is merged and `cartNotices` shown;
 * (2) name and e-mail, prefilled from the profile and saved to it (C-7; the API requires both, `checkout.contact_required`);
 * (3) the summary from `POST /v1/checkout/quote`; (4) `POST /v1/checkout` with the body-bound Idempotency-Key
 * (CheckoutData). With payments off (D-W2) the button registers the donation and the order page says payment is coming.
 * C-3: arriving from "تبرع" with other lines already in the cart, the summary lists them all and says so.
 */
@Component({
  selector: 'ta-checkout-page',
  imports: [RouterLink, Icon, Money, ResourceState, OtpSignIn],
  providers: [CheckoutData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.css',
})
export class CheckoutPage {
  protected readonly auth = inject(StoreAuth);
  protected readonly cart = inject(CartStore);
  protected readonly i18n = inject(I18nService);
  private readonly config = inject(StoreConfig);
  private readonly data = inject(CheckoutData);
  private readonly summary = inject(CartSummary);
  private readonly tokens = inject(OrderTokenStore);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly doc = inject(DOCUMENT);

  protected readonly paymentsEnabled = environment.paymentsEnabled;
  /** C-3: set by the donate box / quick donate when the cart already held other donations. */
  private readonly cameWithOthers = !!(
    this.doc.defaultView?.history.state as CheckoutNavState | null
  )?.otherDonations;

  protected readonly quote = signal<Cart | null>(null);
  protected readonly quoteLoading = signal(true);
  protected readonly quoteFailed = signal(false);
  protected readonly lines = computed(() => this.quote()?.lines ?? []);
  protected readonly othersNotice = computed(() => this.cameWithOthers && this.lines().length > 1);

  protected readonly name = linkedSignal(() => this.auth.customer()?.fullName ?? '');
  protected readonly email = linkedSignal(() => this.auth.customer()?.email ?? '');
  protected readonly touched = signal(false);
  protected readonly nameError = computed(() =>
    this.touched() && this.name().trim().length < 2
      ? $localize`:@@store.checkout.name-required:أدخل الاسم الكامل.`
      : null,
  );
  protected readonly emailError = computed(() => {
    if (!this.touched()) return null;
    const e = this.email().trim();
    if (!e)
      return $localize`:@@store.checkout.email-required-r5:أدخل البريد الإلكتروني لإرسال تأكيد التبرع.`;
    return EMAIL.test(e)
      ? null
      : $localize`:@@store.checkout.email-invalid:بريد إلكتروني غير صحيح.`;
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly invalid = signal<CartProblem[]>([]);
  protected readonly cartEmpty = signal(false);
  protected readonly inProgress = signal(false);
  protected readonly noticeText = cartNoticeText;

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.checkout.title-r5:إتمام التبرع`,
      description: $localize`:@@store.checkout.title-r5:إتمام التبرع`,
      path: '/checkout',
      noindex: true,
    });
    this.cart.load();
    // Signed in (now or by restoring the session): the guest cart was merged server-side — refresh, then re-quote.
    effect(() => {
      const signedIn = this.auth.isSignedIn();
      untracked(
        () => void (signedIn ? this.cart.refresh().then(() => this.loadQuote()) : this.loadQuote()),
      );
    });
  }

  protected title(l: { titleAr: string; titleEn: string | null }): string {
    return this.i18n.pick(l.titleAr, l.titleEn);
  }

  protected optionLabel(l: { optionLabelAr: string | null; optionLabelEn: string | null }): string {
    return l.optionLabelAr ? this.i18n.pick(l.optionLabelAr, l.optionLabelEn) : '';
  }

  protected problemText(p: CartProblem): string {
    const line = this.lines().find((l) => l.id === p.lineId) ?? null;
    const text = lineProblem(p.code, line, {
      minGiftAmount: this.config.minGiftAmount(),
      maxLineAmount: this.config.maxLineAmount(),
      cartMaxLines: this.config.cartMaxLines(),
      cartMaxTotal: this.config.cartMaxTotal(),
    }).text;
    return line ? `${this.title(line)} — ${text}` : text;
  }

  protected async loadQuote(): Promise<void> {
    this.quoteLoading.set(true);
    this.quoteFailed.set(false);
    try {
      this.quote.set(await this.data.quote());
      this.cartEmpty.set(false);
    } catch (e) {
      const p = toProblem(e);
      if (p.code === 'checkout.cart_empty') this.cartEmpty.set(true);
      else this.quoteFailed.set(true);
    } finally {
      this.quoteLoading.set(false);
    }
  }

  protected setName(e: Event): void {
    this.name.set((e.target as HTMLInputElement).value);
  }

  protected setEmail(e: Event): void {
    this.email.set((e.target as HTMLInputElement).value);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.touched.set(true);
    if (this.nameError() || this.emailError() || this.busy()) {
      this.focus('#co-name[aria-invalid=true], #co-email[aria-invalid=true]');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.invalid.set([]);
    this.inProgress.set(false);
    try {
      const out = await this.data.placeOrder({
        fullName: this.name(),
        email: this.email(),
        locale: this.i18n.locale,
      });
      switch (out.kind) {
        case 'created':
          this.tokens.remember(out.order.reference, out.order.statusToken);
          await this.done(out.order.reference);
          return;
        case 'recovered':
          await this.done(out.reference);
          return;
        case 'linesInvalid':
          this.invalid.set(out.problems);
          this.error.set(problemMessage({ code: 'checkout.lines_invalid', status: 422 }));
          await this.cart.refresh();
          await this.loadQuote();
          break;
        case 'cartEmpty':
          this.cartEmpty.set(true);
          await this.cart.refresh();
          break;
        case 'contactRequired':
          this.error.set(problemMessage({ code: 'checkout.contact_required', status: 422 }));
          break;
        case 'inProgress':
          this.inProgress.set(true);
          this.error.set(problemMessage({ code: 'idempotency.in_progress', status: 409 }));
          break;
        case 'error':
          this.error.set(problemMessage(out.problem));
          break;
      }
      this.focus('.co-err');
    } finally {
      this.busy.set(false);
    }
  }

  /** The order exists: the cart is empty server-side, the profile has the saved contact (C-7), go to the order. */
  private async done(reference: string): Promise<void> {
    this.cart.reset();
    void this.summary.load();
    void this.auth.loadMe();
    await this.router.navigate(['/orders', reference]);
  }

  private focus(selector: string): void {
    afterNextRender(() => (this.doc.querySelector(selector) as HTMLElement | null)?.focus(), {
      injector: this.injector,
    });
  }
}
