import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { problemMessage } from '../../../core/api/problem-message';
import { StoreConfig } from '../../../core/api/store-config';
import { CartStore } from '../../../core/cart/cart-store';
import { CartSummary } from '../../../core/cart/cart-summary';
import { I18nService } from '../../../core/i18n/i18n';
import { QuickDonate } from '../../../core/ui/quick-donate.service';
import { AmountInput } from '../../../shared/ui/amount-input/amount-input';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import type { CheckoutNavState } from '../donate/donate-box';
import { QuickDonateData } from './quick-donate.data';

/**
 * Quick donate ("تبرع سريع", M-5): a modal with the categories that accept general gifts, the amount presets from
 * `/catalog/config` plus a custom amount, and **تبرع الآن** → `POST /v1/cart/lines { categoryId, amount }` → checkout.
 * Native `<dialog>` (focus trap, Escape, focus back to the opener); every control is labelled.
 */
@Component({
  selector: 'ta-quick-donate',
  imports: [Dialog, AmountInput, Icon],
  providers: [QuickDonateData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-dialog [open]="qd.open()" labelledBy="qd-h" [lightDismiss]="false" (closed)="close()">
      <form class="qd" (submit)="submit($event)" novalidate>
        <div class="hd">
          <h2 id="qd-h">
            <ta-icon name="gift" [size]="22" /><span i18n="@@store.quick.title">تبرع سريع</span>
          </h2>
          <button
            type="button"
            class="x"
            (click)="close()"
            aria-label="إغلاق"
            i18n-aria-label="@@store.ui.close"
          >
            <ta-icon name="close" [size]="20" />
          </button>
        </div>
        <p class="lede" i18n="@@store.quick.lede">تبرّع لتصنيف عام، ويُصرف تبرعك على مشاريعه.</p>
        <div class="field">
          <label for="qd-cat" i18n="@@store.quick.category">التصنيف</label>
          <select
            id="qd-cat"
            [value]="categoryId() ?? ''"
            (change)="categoryId.set($any($event.target).value || null)"
            aria-describedby="qd-cat-err"
          >
            <option value="" i18n="@@store.quick.choose">اختر</option>
            @for (c of data.list(); track c.id) {
              <option [value]="c.id" [selected]="c.id === categoryId()">
                {{ i18n.pick(c.nameAr, c.nameEn) }}
              </option>
            }
          </select>
          <p class="err" id="qd-cat-err" role="alert">{{ categoryError() }}</p>
        </div>
        <ta-amount-input
          inputId="qd-amount"
          [label]="amountLabel"
          [min]="config.minGiftAmount()"
          [max]="config.maxLineAmount()"
          [presets]="config.amountPresets()"
          [(raw)]="raw"
          [(touched)]="touched"
          (amountChange)="amount.set($event)"
        />
        @if (error(); as e) {
          <p class="banner err" role="alert">{{ e }}</p>
        }
        <button
          type="submit"
          class="go"
          [disabled]="busy() || !config.ready()"
          [attr.aria-busy]="busy()"
        >
          <ta-icon name="heart" [size]="18" /><span i18n="@@store.quick.submit">تبرع الآن</span>
        </button>
      </form>
    </ta-dialog>
  `,
  styles: `
    .qd {
      display: grid;
      gap: 14px;
      padding: 20px;
      inline-size: min(440px, 92vw);
      background: var(--c-surface);
      color: var(--c-text);
    }
    .hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.2rem;
      margin: 0;
    }
    .x {
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border: 0;
      background: none;
      color: var(--c-muted);
      cursor: pointer;
    }
    .lede {
      margin: 0;
      color: var(--c-muted);
      font-size: 0.9rem;
    }
    .field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-block-end: 4px;
    }
    select {
      inline-size: 100%;
      min-block-size: 44px;
      border-radius: 12px;
      border: 1px solid var(--c-border-2);
      background: var(--c-surface);
      color: var(--c-text);
      font: inherit;
      padding-inline: 12px;
    }
    .err {
      margin: 4px 0 0;
      min-block-size: 1.2em;
      font-size: 0.8rem;
      color: var(--c-danger);
    }
    .banner {
      margin: 0;
    }
    .go {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-block-size: 50px;
      border: 0;
      border-radius: var(--r);
      background: var(--c-brand-strong);
      color: var(--c-on-brand);
      font: inherit;
      font-weight: 600;
      font-size: 1.02rem;
      cursor: pointer;
    }
    .go:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,
})
export class QuickDonateModal {
  protected readonly qd = inject(QuickDonate);
  protected readonly data = inject(QuickDonateData);
  protected readonly config = inject(StoreConfig);
  protected readonly i18n = inject(I18nService);
  private readonly cart = inject(CartStore);
  private readonly summary = inject(CartSummary);
  private readonly router = inject(Router);

  protected readonly amountLabel = $localize`:@@store.donate.amount-label:المبلغ`;
  /** One category accepting gifts → preselected. */
  protected readonly categoryId = linkedSignal<string | null>(() =>
    this.data.list().length === 1 ? this.data.list()[0].id : null,
  );
  protected readonly raw = signal('');
  protected readonly amount = signal<string | null>(null);
  protected readonly touched = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly categoryError = computed(() =>
    this.touched() && !this.categoryId()
      ? $localize`:@@store.quick.category-required:اختر التصنيف.`
      : '',
  );

  protected close(): void {
    this.qd.hide();
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.touched.set(true);
    const categoryId = this.categoryId();
    const amount = this.amount();
    const category = this.data.list().find((c) => c.id === categoryId);
    if (!category || !amount || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const hadOthers = this.summary.count() > 0;
    try {
      const ok = await this.cart.add({
        kind: 'category',
        categoryId: category.id,
        amount,
        preview: { titleAr: category.nameAr, titleEn: category.nameEn, slug: category.slug },
      });
      if (!ok) {
        const p = this.cart.lastProblem();
        this.error.set(p ? problemMessage(p) : null);
        return;
      }
      this.qd.open.set(false);
      this.raw.set('');
      this.touched.set(false);
      const state: CheckoutNavState = { otherDonations: hadOthers };
      await this.router.navigateByUrl('/checkout', { state });
    } finally {
      this.busy.set(false);
    }
  }
}
