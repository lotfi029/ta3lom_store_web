import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Category } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { StoreConfig } from '../../../core/api/store-config';
import { CartStore } from '../../../core/cart/cart-store';
import { CartSummary } from '../../../core/cart/cart-summary';
import { I18nService } from '../../../core/i18n/i18n';
import { AmountInput } from '../../../shared/ui/amount-input/amount-input';
import { Icon } from '../../../shared/ui/icon/icon';
import type { CheckoutNavState } from '../donate/donate-box';

/**
 * The quick-donate form (M-5, Option C §3 row 4 + §5): category (only categories that accept general gifts), amount
 * presets from `/catalog/config` + a custom amount (min `minGiftAmount`, max `maxLineAmount` — never hard-coded), and
 * **تبرع الآن** → `POST /v1/cart/lines { categoryId, amount }` → `/checkout`. API problems (422 …) are shown through
 * `problemMessage`. Used by the modal (`variant="modal"`: the category select is always shown, nothing preselected
 * unless there is only one) and by the home page's inline card (`variant="inline"`: the first category by the API's
 * `sort` is the general fund — C-3, REVIEW — and the select appears only when there are several).
 */
@Component({
  selector: 'ta-quick-donate-form',
  imports: [AmountInput, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="qdf" [class.inline]="variant() === 'inline'" (submit)="submit($event)" novalidate>
      @if (showSelect()) {
        <div class="field">
          <label [for]="idPrefix() + '-cat'" i18n="@@store.quick.category">التصنيف</label>
          <select
            [id]="idPrefix() + '-cat'"
            (change)="categoryId.set($any($event.target).value || null)"
            [attr.aria-describedby]="idPrefix() + '-cat-err'"
          >
            @if (variant() === 'modal') {
              <option value="" i18n="@@store.quick.choose">اختر</option>
            }
            @for (c of list(); track c.id) {
              <option [value]="c.id" [selected]="c.id === categoryId()">
                {{ i18n.pick(c.nameAr, c.nameEn) }}
              </option>
            }
          </select>
          <p class="err" [id]="idPrefix() + '-cat-err'" role="alert">{{ categoryError() }}</p>
        </div>
      }
      <ta-amount-input
        [inputId]="idPrefix() + '-amount'"
        [label]="amountLabel"
        [placeholder]="otherAmount"
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
  `,
  styles: `
    :host {
      display: block;
    }
    .qdf {
      display: grid;
      gap: var(--space-3);
    }
    .qdf.inline {
      block-size: 100%;
      grid-template-rows: auto auto 1fr auto;
    }
    .field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-block-end: var(--space-1);
    }
    select {
      inline-size: 100%;
      min-block-size: 44px;
      border-radius: var(--r);
      border: 1px solid var(--c-border-2);
      background: var(--c-surface);
      color: var(--c-text);
      font: inherit;
      padding-inline: var(--space-3);
    }
    .err {
      margin-block: var(--space-1) 0;
      min-block-size: 1.2em;
      font-size: 0.8rem;
      color: var(--c-danger);
    }
    .banner {
      margin: 0;
    }
    .go {
      align-self: end;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-block-size: 50px;
      border: 0;
      border-radius: var(--rp);
      background: var(--c-brand-strong);
      color: var(--c-on-brand);
      font: inherit;
      font-weight: 700;
      font-size: 1.02rem;
      cursor: pointer;
    }
    .go:hover {
      background: var(--c-brand-deep);
    }
    .go:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,
})
export class QuickDonateForm {
  protected readonly config = inject(StoreConfig);
  protected readonly i18n = inject(I18nService);
  private readonly cart = inject(CartStore);
  private readonly summary = inject(CartSummary);
  private readonly router = inject(Router);

  /** The categories that accept general gifts, in the API order (`sort`). */
  readonly list = input.required<readonly Category[]>();
  readonly variant = input<'modal' | 'inline'>('modal');
  readonly idPrefix = input('qd');
  /** Emitted once the line is in the cart, before navigating to checkout (the modal closes on it). */
  readonly added = output<void>();

  protected readonly amountLabel = $localize`:@@store.donate.amount-label:المبلغ`;
  protected readonly otherAmount = $localize`:@@store.quick.other-amount:مبلغ آخر`;
  protected readonly showSelect = computed(
    () => this.variant() === 'modal' || this.list().length > 1,
  );
  /** Inline: the first category (C-3). Modal: preselected only when it is the only one. */
  readonly categoryId = linkedSignal<string | null>(() => {
    const l = this.list();
    if (this.variant() === 'inline') return l[0]?.id ?? null;
    return l.length === 1 ? l[0].id : null;
  });
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

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.touched.set(true);
    const categoryId = this.categoryId();
    const amount = this.amount();
    const category = this.list().find((c) => c.id === categoryId);
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
      this.added.emit();
      this.raw.set('');
      this.touched.set(false);
      const state: CheckoutNavState = { otherDonations: hadOthers };
      await this.router.navigateByUrl('/checkout', { state });
    } finally {
      this.busy.set(false);
    }
  }
}
