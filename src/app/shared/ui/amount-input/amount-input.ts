import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n';
import { type AmountCheck, checkAmount, displayAmount } from '../../../core/money/amount';
import { currencyLabel, formatMoney } from '../../../core/money/money-format';
import { compare, normalize } from '../../../core/money/money';

/** The message for a failed check (shown after blur or a submit attempt). */
export function amountMessage(check: AmountCheck, locale: 'ar' | 'en'): string | null {
  if (check.ok) return null;
  switch (check.reason) {
    case 'empty':
      return $localize`:@@store.amount.required:أدخل مبلغ التبرع.`;
    case 'min':
      return $localize`:@@store.amount.min:أقل مبلغ للتبرع ${formatMoney(check.limit ?? '0.00', locale)}:min:.`;
    case 'max':
      return $localize`:@@store.amount.max:أعلى مبلغ للتبرع الواحد ${formatMoney(check.limit ?? '0.00', locale)}:max:.`;
    default:
      return $localize`:@@store.amount.format:أدخل مبلغًا صحيحًا بالريال، مثل 50 أو 50.5.`;
  }
}

/**
 * The donation amount field ("تبرع مفتوح"): optional preset buttons (from `/catalog/config` amountPresets, those within
 * the limits), a text field with `inputmode="decimal"` that accepts Arabic digits and normalises them to Western digits
 * on blur, and the min/max check (min = the project's `minAmount` or the config's `minGiftAmount`, max = the config's
 * `maxLineAmount`). Emits the normalised amount (`"50.00"`) when valid, else null. Presentational.
 */
@Component({
  selector: 'ta-amount-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shownPresets().length) {
      <div class="presets" role="group" [attr.aria-label]="presetsLabel">
        @for (p of shownPresets(); track p) {
          <button
            type="button"
            class="preset"
            [attr.aria-pressed]="isPreset(p)"
            [disabled]="disabled()"
            (click)="pick(p)"
          >
            <bdi>{{ fmt(p) }}</bdi>
          </button>
        }
      </div>
    }
    <label class="lbl" [for]="inputId()">{{ label() }}</label>
    <div class="field" [class.bad]="!!error()">
      <input
        [id]="inputId()"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        dir="ltr"
        [value]="raw()"
        [disabled]="disabled()"
        [attr.placeholder]="placeholder()"
        [attr.aria-invalid]="!!error()"
        [attr.aria-describedby]="inputId() + '-err'"
        (input)="onInput($event)"
        (blur)="onBlur($event)"
      />
      <span class="cur" aria-hidden="true">{{ cur }}</span>
    </div>
    <p class="err" [id]="inputId() + '-err'" role="alert">{{ error() }}</p>
  `,
  styles: `
    :host {
      display: block;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-end: 8px;
    }
    .preset {
      min-block-size: 44px;
      min-inline-size: 64px;
      padding-inline: 12px;
      border-radius: var(--rp);
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      color: var(--c-text);
      font: inherit;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .preset[aria-pressed='true'] {
      border-color: var(--c-accent-strong);
      background: var(--c-tint);
      color: var(--c-accent-strong);
    }
    .lbl {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-block-end: 4px;
    }
    .field {
      display: flex;
      align-items: center;
      border: 1px solid var(--c-border-2);
      border-radius: 12px;
      background: var(--c-surface);
      padding-inline: 12px;
    }
    .field:focus-within {
      border-color: var(--c-brand);
    }
    .field.bad {
      border-color: var(--c-danger);
    }
    input {
      flex: 1;
      min-inline-size: 0;
      block-size: 44px;
      border: 0;
      background: none;
      font: inherit;
      font-variant-numeric: tabular-nums;
      color: var(--c-text);
      outline: none;
    }
    .cur {
      color: var(--c-muted);
      font-size: 0.85rem;
    }
    .err {
      margin: 4px 0 0;
      min-block-size: 1.2em;
      font-size: 0.8rem;
      color: var(--c-danger);
    }
  `,
})
export class AmountInput {
  private readonly locale = inject(I18nService).locale;
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly presets = input<readonly string[]>([]);
  readonly placeholder = input<string | null>(null);
  readonly disabled = input(false);
  /** What the donor typed (or the preset picked). */
  readonly raw = model('');
  /** Set by the parent on a submit attempt, so an empty field shows its message too. */
  readonly touched = model(false);
  readonly amountChange = output<string | null>();

  protected readonly cur = currencyLabel(this.locale);
  protected readonly presetsLabel = $localize`:@@store.amount.presets:مبالغ مقترحة`;
  readonly check = computed(() => checkAmount(this.raw(), this.min(), this.max()));
  protected readonly error = computed(() =>
    this.touched() ? amountMessage(this.check(), this.locale) : null,
  );
  /** Presets outside the limits are not offered. */
  protected readonly shownPresets = computed(() =>
    this.presets().filter(
      (p) =>
        (!this.min() || compare(p, this.min() as string) >= 0) &&
        (!this.max() || compare(p, this.max() as string) <= 0),
    ),
  );

  protected fmt(p: string): string {
    return formatMoney(p, this.locale);
  }

  protected isPreset(p: string): boolean {
    const c = this.check();
    return c.ok && c.amount === normalize(p);
  }

  protected pick(p: string): void {
    this.raw.set(normalize(p).replace(/\.00$/, ''));
    this.touched.set(true);
    this.emit();
  }

  protected onInput(event: Event): void {
    this.raw.set((event.target as HTMLInputElement).value);
    this.emit();
  }

  protected onBlur(event: Event): void {
    const el = event.target as HTMLInputElement;
    const shown = displayAmount(el.value);
    if (shown !== el.value) el.value = shown;
    this.raw.set(shown);
    this.touched.set(true);
    this.emit();
  }

  private emit(): void {
    const c = this.check();
    this.amountChange.emit(c.ok ? c.amount : null);
  }
}
