import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';

export interface FilterPill {
  key: string;
  /** e.g. «التصنيف: التعليم» */
  label: string;
}

/** Active filters as removable pills (02 §2); empty renders nothing. */
@Component({
  selector: 'ta-filter-pills',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pills().length) {
      <ul class="fp" [attr.aria-label]="label()">
        @for (p of pills(); track p.key) {
          <li>
            <span>{{ p.label }}</span>
            <button
              type="button"
              (click)="removed.emit(p.key)"
              [attr.aria-label]="removeLabel(p.label)"
            >
              <ta-icon name="close" [size]="14" />
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .fp {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    li {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding-inline-start: 10px;
      border-radius: 8px;
      background: var(--c-surface-2);
      font-size: 0.82rem;
    }
    button {
      display: inline-grid;
      place-items: center;
      min-inline-size: 32px;
      min-block-size: 32px;
      border: 0;
      background: none;
      color: var(--c-muted);
      cursor: pointer;
    }
    button:hover {
      color: var(--c-text);
    }
  `,
})
export class FilterPills {
  readonly pills = input.required<readonly FilterPill[]>();
  readonly label = input.required<string>();
  readonly removed = output<string>();
  protected removeLabel(label: string): string {
    return $localize`:@@store.admin.filter-remove:إزالة الفلتر ${label}:filter:`;
  }
}
