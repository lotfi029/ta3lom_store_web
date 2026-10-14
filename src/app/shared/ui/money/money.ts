import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n';
import { currencyLabel, formatAmount } from '../../../core/money/money-format';
import { compare, type Money as MoneyValue } from '../../../core/money/money';

/**
 * `<ta-money [value]="'350.00'" [compareAt]="'450.00'" />` — prototype `.price`: amount, `.cur` label and the struck
 * compare-at price (shown only when higher). Display only; the amount is a decimal string, never a float.
 * `<bdi>` keeps the digits LTR inside Arabic text.
 */
@Component({
  selector: 'ta-money',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<bdi class="amt">{{ amount() }}</bdi
    ><span class="cur">{{ cur }}</span>
    @if (was(); as w) {
      <s
        ><span class="visually-hidden" i18n="@@store.ui.was-price">بدلًا من</span>
        <bdi>{{ w }}</bdi></s
      >
    }`,
  styles: `
    :host {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .cur {
      margin-inline-start: 0.3em;
      font-size: 0.78em;
      font-weight: 500;
      color: var(--c-muted-2);
    }
    s {
      color: var(--c-muted-2);
      font-weight: 400;
      font-size: 0.85em;
      margin-inline-start: 6px;
    }
  `,
})
export class Money {
  private readonly locale = inject(I18nService).locale;
  readonly value = input.required<MoneyValue>();
  readonly compareAt = input<MoneyValue | null | undefined>(null);
  protected readonly cur = currencyLabel(this.locale);
  protected readonly amount = computed(() => formatAmount(this.value(), this.locale));
  protected readonly was = computed(() => {
    const c = this.compareAt();
    return c && compare(c, this.value()) > 0 ? formatAmount(c, this.locale) : null;
  });
}
