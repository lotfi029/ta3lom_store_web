import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Prototype `.steps`: cart → details and payment → confirmation. `current` is 1-based. */
@Component({
  selector: 'ta-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps" aria-label="مراحل الطلب" i18n-aria-label="@@store.steps.label">
      @for (s of labels; track $index) {
        <li [class.on]="$index + 1 === current()" [class.done]="$index + 1 < current()" [attr.aria-current]="$index + 1 === current() ? 'step' : null">
          <i aria-hidden="true">{{ $index + 1 }}</i>{{ s }}
        </li>
        @if (!$last) {
          <li class="ln" aria-hidden="true"></li>
        }
      }
    </ol>
  `,
  styles: `
    .steps {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0 0 26px;
      padding: 0;
      list-style: none;
      font-size: 0.85rem;
      color: var(--c-muted);
      flex-wrap: wrap;
    }
    li {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    i {
      font-style: normal;
      inline-size: 24px;
      block-size: 24px;
      border-radius: 50%;
      background: var(--c-surface-3);
      color: var(--c-text);
      display: grid;
      place-items: center;
      font-family: var(--fm);
      font-size: 0.75rem;
    }
    .on {
      color: var(--c-text);
      font-weight: 500;
    }
    .on i {
      background: var(--c-brand-strong);
      color: var(--c-on-brand);
    }
    .done i {
      background: var(--c-success-text);
      color: var(--c-on-brand);
    }
    .ln {
      inline-size: 28px;
      block-size: 1px;
      background: var(--c-border);
    }
  `,
})
export class Steps {
  readonly current = input.required<1 | 2 | 3>();
  protected readonly labels = [
    $localize`:@@store.steps.cart:السلة`,
    $localize`:@@store.steps.details:البيانات والدفع`,
    $localize`:@@store.steps.confirm:التأكيد`,
  ];
}
