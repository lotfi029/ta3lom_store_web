import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n';
import { formatMoney } from '../../../core/money/money-format';

export interface PickerOption {
  id: string;
  label: string;
  amount: string;
}

/** The value of the "تبرع مفتوح" (open amount) choice. */
export const OPEN_AMOUNT = 'open';

/**
 * Donation options as chips (D-W5): each option with its fixed price, plus "تبرع مفتوح" when the project allows an open
 * amount. Native radio inputs (one tab stop, arrow keys move, Space selects) styled as 44 px chips. The selected value
 * is an option id, `OPEN_AMOUNT`, or null. Presentational.
 */
@Component({
  selector: 'ta-option-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend class="visually-hidden">{{ legend() }}</legend>
      <div class="chips">
        @for (o of options(); track o.id) {
          <label class="chip" [class.on]="selected() === o.id">
            <input
              type="radio"
              [name]="name()"
              [value]="o.id"
              [checked]="selected() === o.id"
              (change)="selected.set(o.id)"
            />
            <span class="t">{{ o.label }}</span>
            <bdi class="p">{{ fmt(o.amount) }}</bdi>
          </label>
        }
        @if (allowOpen()) {
          <label class="chip" [class.on]="selected() === open">
            <input
              type="radio"
              [name]="name()"
              [value]="open"
              [checked]="selected() === open"
              (change)="selected.set(open)"
            />
            <span class="t" i18n="@@store.donate.open-amount">تبرع مفتوح</span>
          </label>
        }
      </div>
    </fieldset>
  `,
  styles: `
    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
      min-inline-size: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--c-border);
      border-radius: var(--rp);
      background: var(--c-surface);
      color: var(--c-text);
      font-size: 0.86rem;
      cursor: pointer;
    }
    .chip:hover {
      border-color: var(--c-text);
    }
    .chip.on {
      border-color: var(--c-accent-strong);
      background: var(--c-tint);
      color: var(--c-accent-strong);
      font-weight: 600;
    }
    .chip:focus-within {
      outline: 2px solid var(--c-focus);
      outline-offset: 2px;
    }
    input {
      position: absolute;
      opacity: 0;
      inset: 0;
      margin: 0;
      cursor: pointer;
    }
    .p {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `,
})
export class OptionPicker {
  private readonly locale = inject(I18nService).locale;
  readonly name = input.required<string>();
  readonly legend = input.required<string>();
  readonly options = input.required<readonly PickerOption[]>();
  readonly allowOpen = input(false);
  readonly selected = model<string | null>(null);
  protected readonly open = OPEN_AMOUNT;

  protected fmt(amount: string): string {
    return formatMoney(amount, this.locale);
  }
}
