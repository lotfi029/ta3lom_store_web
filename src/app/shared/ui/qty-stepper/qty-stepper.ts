import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { westernDigits } from '../../../core/i18n/western-digits';
import { Icon } from '../icon/icon';

/** Clamps a typed quantity (Arabic-Indic digits accepted) to [min, max]; anything unreadable keeps `fallback`. */
export function clampQuantity(
  raw: string | number,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(westernDigits(String(raw)).trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * `− n +` quantity stepper (D-04: 1…max, max from `/catalog/config`). The buttons are 44 × 44 px, the field accepts
 * typing (Arabic-Indic digits too) and clamps on change. Presentational: the parent owns the value.
 */
@Component({
  selector: 'ta-qty-stepper',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stepper" role="group" [attr.aria-labelledby]="inputId() + '-l'">
      <span class="visually-hidden" [id]="inputId() + '-l'">{{ label() }}</span>
      <button
        type="button"
        class="b"
        (click)="step(-1)"
        [disabled]="disabled() || value() <= min()"
        aria-label="إنقاص الكمية"
        i18n-aria-label="@@store.ui.qty-decrease"
      >
        <ta-icon name="minus" [size]="18" />
      </button>
      <input
        [id]="inputId()"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-label]="label()"
        (change)="typed($event)"
      />
      <button
        type="button"
        class="b"
        (click)="step(1)"
        [disabled]="disabled() || value() >= max()"
        aria-label="زيادة الكمية"
        i18n-aria-label="@@store.ui.qty-increase"
      >
        <ta-icon name="plus" [size]="18" />
      </button>
    </div>
  `,
  styles: `
    .stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--c-border);
      border-radius: var(--rp);
      background: var(--c-surface);
    }
    .b {
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border: 0;
      background: none;
      color: var(--c-text);
      cursor: pointer;
      border-radius: var(--rp);
    }
    .b:disabled {
      color: var(--c-muted-2);
      cursor: default;
    }
    input {
      inline-size: 3.2em;
      block-size: 44px;
      border: 0;
      background: none;
      text-align: center;
      font: inherit;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--c-text);
    }
  `,
})
export class QtyStepper {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly min = input(1);
  readonly max = input.required<number>();
  readonly disabled = input(false);
  readonly value = model(1);

  protected step(delta: number): void {
    this.value.set(clampQuantity(this.value() + delta, this.min(), this.max(), this.value()));
  }

  protected typed(event: Event): void {
    const el = event.target as HTMLInputElement;
    const v = clampQuantity(el.value, this.min(), this.max(), this.value());
    el.value = String(v);
    this.value.set(v);
  }
}
