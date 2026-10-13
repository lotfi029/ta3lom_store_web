import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import type { Address, CartLine, CartNotice, Quote } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { StoreConfig } from '../../../core/api/store-config';
import { StoreAuth } from '../../../core/auth/store-auth';
import { cartNoticeText } from '../../../core/cart/cart-notice-text';
import { CartStore } from '../../../core/cart/cart-store';
import { CartSummary } from '../../../core/cart/cart-summary';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { formatMoney } from '../../../core/money/money-format';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { Steps } from '../../../shared/ui/steps/steps';
import { OtpSignIn } from '../login/otp-sign-in';
import { CheckoutData, type LineProblem } from './checkout.data';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  checkoutForm,
  emptyCheckout,
  normalizeShortAddress,
} from './checkout.form';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  mada: 'mada',
  applepay: 'Apple Pay',
  card: 'VISA / Mastercard',
  stcpay: 'STC Pay',
};

/**
 * `/checkout` (FR-S30–S33, 10 §7): identity by inline OTP (RUL-25), details, shipping only with a print line (RUL-26),
 * payment method (RUL-36) and terms (FR-S30). The summary shows the server quote (RUL-15). Placing the order sends an
 * Idempotency-Key; `checkout.price_changed` swaps in the new quote and asks to pay again. No gateway code here: with no
 * `redirectUrl` (today) the page goes to the thanks page, which shows "Awaiting payment".
 */
@Component({
  selector: 'ta-checkout-page',
  imports: [RouterLink, FormField, Icon, Money, ResourceState, Steps, OtpSignIn],
  providers: [CheckoutData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.css',
})
export class CheckoutPage {
  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(StoreAuth);
  protected readonly config = inject(StoreConfig);
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject(CheckoutData);
  private readonly summary = inject(CartSummary);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly model = signal(emptyCheckout());
  protected readonly needsAddress = computed(() => this.cart.hasPrint());
  protected readonly f = checkoutForm(this.model, () => this.needsAddress());

  protected readonly quote = signal<Quote | null>(null);
  protected readonly busy = signal(false);
  protected readonly priceChanged = signal(false);
  protected readonly invalidLines = signal<LineProblem[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly blocked = signal(false);
  /** Shown on the button once the order exists (prototype copy). */
  protected readonly redirecting = signal(false);

  protected readonly methods = computed<PaymentMethod[]>(() => {
    const allowed = this.config.paymentMethods();
    const list = PAYMENT_METHODS.filter((m) => allowed.length === 0 || allowed.includes(m));
    return list.length ? list : [...PAYMENT_METHODS];
  });
  protected readonly saved = computed<Address[]>(() => this.data.savedAddresses());
  protected readonly newAddress = computed(
    () => this.needsAddress() && this.model().savedId === 'new',
  );

  /** Totals: the quote when present (authoritative, RUL-15), else the cart's own figures. */
  protected readonly totals = computed(() => {
    const q = this.quote();
    if (q)
      return {
        purchases: q.purchasesTotal,
        shipping: q.shippingTotal,
        grand: q.grandTotal,
        requiresShipping: q.requiresShipping,
      };
    const t = this.cart.totals();
    return {
      purchases: t.purchases,
      shipping: t.shipping,
      grand: t.grand,
      requiresShipping: t.requiresShipping,
    };
  });
  protected readonly payLabel = computed(
    () =>
      $localize`:@@store.checkout.pay:ادفع ${formatMoney(this.totals().grand, this.i18n.locale)}:amount:`,
  );

  private readonly errorBox = viewChild<ElementRef<HTMLElement>>('errorBox');
  private readonly changedBox = viewChild<ElementRef<HTMLElement>>('changedBox');

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.checkout.title:إتمام الطلب`,
      description: $localize`:@@store.checkout.seo-description:أدخل بياناتك واختر طريقة الدفع لإتمام طلبك.`,
      path: '/checkout',
      noindex: true,
    });
    this.cart.load();

    // A new server cart (first load, merge after sign-in) → a fresh quote for the summary.
    effect(() => {
      const snap = this.cart.snapshot();
      if (snap && snap.purchases.length > 0) untracked(() => void this.refreshQuote());
    });
    // RUL-17: signing in here merges the guest cart into the customer's — fetch the merged cart (and its notices). This
    // watches the session rather than the OTP component's output: the component is removed as soon as the token lands.
    let wasGuest = false;
    effect(() => {
      const signedIn = this.auth.isSignedIn();
      untracked(() => {
        if (!signedIn) wasGuest = true;
        else if (wasGuest) {
          wasGuest = false;
          void this.cart.refresh();
        }
      });
    });
    // Prefill name and email from the session, then from /me (10 §7.1).
    effect(() => {
      const c = this.auth.customer();
      const p = valueOf(this.data.profile);
      const name = p?.fullName ?? c?.fullName ?? '';
      const email = p?.email ?? c?.email ?? '';
      untracked(() =>
        this.model.update((m) => ({ ...m, name: m.name || name, email: m.email || email })),
      );
    });
    // The default saved address is pre-selected.
    effect(() => {
      const list = this.saved();
      const def = list.find((a) => a.isDefault) ?? list[0];
      untracked(() => {
        if (def && this.model().savedId === 'new')
          this.model.update((m) => ({ ...m, savedId: def.id }));
      });
    });
    // Short address shown as it will be stored (upper case, Western digits).
    effect(() => {
      const raw = this.model().address.shortAddress;
      const norm = normalizeShortAddress(raw);
      if (norm !== raw)
        untracked(() =>
          this.model.update((m) => ({ ...m, address: { ...m.address, shortAddress: norm } })),
        );
    });
  }

  protected title(l: CartLine): string {
    return this.i18n.pick(l.titleAr, l.titleEn);
  }

  protected qty(l: CartLine): number {
    return toInt(l.quantity, 1);
  }

  protected lineAmount(l: CartLine): string {
    return this.quote()?.lines.find((q) => q.lineId === l.id)?.amount ?? l.amount;
  }

  protected lineChanged(l: CartLine): boolean {
    return (
      this.priceChanged() &&
      this.quote()?.lines.some((q) => q.lineId === l.id && q.status === 'changed') === true
    );
  }

  protected methodLabel(m: PaymentMethod): string {
    return METHOD_LABELS[m];
  }

  protected addressLabel(a: Address): string {
    return [a.recipientName, a.city, a.district, a.shortAddress].filter(Boolean).join(' · ');
  }

  protected noticeText(n: CartNotice): string {
    return cartNoticeText(n);
  }

  protected lineTitle(lineId: string): string {
    const l = this.cart.lines().find((x) => x.id === lineId);
    return l ? this.title(l) : '';
  }

  protected issueText(code: string): string {
    return problemMessage({ code, status: 422 });
  }

  protected setMethod(m: PaymentMethod): void {
    this.model.update((x) => ({ ...x, method: m }));
  }

  protected setSaved(id: string): void {
    this.model.update((x) => ({ ...x, savedId: id }));
  }

  protected setTerms(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.model.update((x) => ({ ...x, acceptTerms: checked }));
    this.f.acceptTerms().markAsTouched();
  }

  protected setSaveAddress(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.model.update((x) => ({ ...x, saveAddress: checked }));
  }

  private async refreshQuote(): Promise<Quote | null> {
    try {
      const q = await this.data.quote();
      this.quote.set(q);
      return q;
    } catch {
      return null;
    }
  }

  protected async pay(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.redirecting()) return;
    this.f().markAsTouched();
    if (this.f().invalid()) {
      afterNextRender(
        () => document.querySelector<HTMLElement>('.co [aria-invalid="true"]')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.invalidLines.set([]);
    try {
      const q = this.quote() ?? (await this.refreshQuote());
      if (!q) {
        this.showError(problemMessage({ code: 'network.error', status: 0 }));
        return;
      }
      const outcome = await this.data.placeOrder(
        this.data.buildRequest(this.model(), this.needsAddress(), q.grandTotal),
      );
      switch (outcome.kind) {
        case 'created': {
          this.redirecting.set(true);
          void this.summary.load();
          this.cart.reload();
          const url = outcome.order.payment.redirectUrl;
          if (url && this.browser) {
            location.assign(url);
            return;
          }
          await this.router.navigate(['/orders', outcome.order.reference, 'thanks'], {
            queryParams: { t: outcome.order.statusToken },
          });
          return;
        }
        case 'priceChanged': {
          if (outcome.quote) this.quote.set(outcome.quote);
          else await this.refreshQuote();
          this.priceChanged.set(true);
          afterNextRender(() => this.changedBox()?.nativeElement.focus(), {
            injector: this.injector,
          });
          return;
        }
        case 'linesInvalid':
          this.invalidLines.set(outcome.lines);
          this.showError(problemMessage({ code: 'checkout.lines_invalid', status: 422 }));
          return;
        case 'gatewayDown':
          this.redirecting.set(true);
          await this.router.navigate(['/orders', outcome.reference, 'thanks'], {
            queryParams: { t: outcome.statusToken },
          });
          return;
        case 'error': {
          const p = outcome.problem;
          if (p.code === 'auth.account_blocked') {
            this.blocked.set(true);
            return;
          }
          if (p.code === 'auth.unauthenticated') await this.auth.ensureSession();
          this.showError(problemMessage(p));
          return;
        }
      }
    } finally {
      this.busy.set(false);
    }
  }

  private showError(message: string): void {
    this.error.set(message);
    afterNextRender(() => this.errorBox()?.nativeElement.focus(), { injector: this.injector });
  }
}
