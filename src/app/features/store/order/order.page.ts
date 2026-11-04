import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { PaymentRedirect } from '../../../core/payments/payment-redirect';
import { StoreAuth } from '../../../core/auth/store-auth';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { OtpSignIn } from '../login/otp-sign-in';
import { OrderData } from './order.data';

/** Removes `t` from a URL (E-2), keeping every other parameter and the hash. */
export function withoutToken(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('t');
  return u.pathname + (u.search === '?' ? '' : u.search) + u.hash;
}

/**
 * `/orders/:ref` (W-M3, plan §6 F5): where the donor lands back from the gateway — never trusted as proof of payment;
 * the page polls the API: paid (thanks, receipt number, download), pending (the gateway has not answered yet), retry
 * ("أعد محاولة الدفع" → a new attempt, redirect only to allow-listed hosts), expired, review, refunded (DRC). E-2: the `?t=` status token
 * is kept in memory + sessionStorage and removed from the address bar at once; the page sets
 * `Referrer-Policy: no-referrer`, is noindex and has no share bar. R3-2: signed out without a (valid) token → sign in to
 * view it (OTP), not the generic not-found.
 */
@Component({
  selector: 'ta-order-page',
  imports: [RouterLink, Icon, Money, StatusPill, OtpSignIn],
  providers: [OrderData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order.page.html',
  styleUrl: './order.page.css',
})
export class OrderPage {
  protected readonly data = inject(OrderData);
  protected readonly auth = inject(StoreAuth);
  protected readonly i18n = inject(I18nService);
  private readonly doc = inject(DOCUMENT);
  private readonly meta = inject(Meta);

  readonly ref = input.required<string>();
  readonly t = input<string>();

  protected readonly status = computed(() => orderStatus(this.data.state() ?? ''));
  protected readonly lineCount = computed(() => toInt(this.data.value()?.lineCount));
  protected readonly refunded = computed(
    () => (this.data.value()?.refundedAmount ?? '0.00') !== '0.00',
  );
  protected readonly paying = signal(false);
  protected readonly payError = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  private readonly redirect = inject(PaymentRedirect);

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.order.title:تبرعك`,
      description: $localize`:@@store.order.title:تبرعك`,
      path: '/orders',
      noindex: true,
    });
    // E-2: no Referer from this page (the deploy header says the same for /orders/*).
    this.meta.updateTag({ name: 'referrer', content: 'no-referrer' });
    inject(DestroyRef).onDestroy(() => this.meta.removeTag('name="referrer"'));
    effect(() => {
      const ref = this.ref();
      const t = this.t() ?? null;
      untracked(() => {
        this.data.open(ref, t);
        this.stripToken();
      });
    });
    // Restoring the session may sign the donor in after the first request: ask again with the bearer.
    void this.auth.ensureSession();
  }

  /** E-2: drop `t` from the address bar without a navigation (the history entry is replaced). */
  private stripToken(): void {
    const w = this.doc.defaultView;
    if (!w || !w.location.search.includes('t=')) return;
    w.history.replaceState(w.history.state, '', withoutToken(w.location.href));
  }

  /** "Pay again": a new attempt; leave only for an allow-listed hosted page. */
  protected async payAgain(): Promise<void> {
    this.paying.set(true);
    this.payError.set(null);
    try {
      const out = await this.data.payAgain();
      if (out.kind === 'problem') {
        this.payError.set(problemMessage(out.problem));
      } else if (!this.redirect.go(out.url)) {
        this.payError.set(problemMessage({ code: 'payment.gateway_unavailable', status: 503 }));
      }
    } finally {
      this.paying.set(false);
    }
  }

  /** Saves the receipt PDF (DR or DRC) through an object URL (no token in any address bar or history). */
  protected async download(kind: 'dr' | 'drc'): Promise<void> {
    this.downloading.set(true);
    this.downloadError.set(null);
    try {
      const out = await this.data.receipt(kind);
      if (!('blob' in out)) {
        this.downloadError.set(problemMessage(out));
        return;
      }
      const w = this.doc.defaultView;
      if (!w) return;
      const url = w.URL.createObjectURL(out.blob);
      const a = this.doc.createElement('a');
      a.href = url;
      a.download = out.fileName;
      a.rel = 'noopener';
      this.doc.body.appendChild(a);
      a.click();
      a.remove();
      w.setTimeout(() => w.URL.revokeObjectURL(url), 10_000);
    } finally {
      this.downloading.set(false);
    }
  }

  protected formatDate(v: string | undefined): string {
    return v ? this.i18n.formatDateTime(v) : '';
  }
}
