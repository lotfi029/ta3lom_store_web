import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface SummaryCard {
  key: string;
  label: string;
  /** From the API; null while loading or when the API cannot count it (shown as —, never invented). */
  value: number | null;
}

/** The summary row of an index page (02 §2): up to four counts; 2 × 2 on tablets and phones. */
@Component({
  selector: 'ta-summary-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="sc" [attr.aria-label]="label()">
      @for (c of cards(); track c.key) {
        <li>
          <span class="l">{{ c.label }}</span>
          <b>{{ c.value ?? '—' }}</b>
        </li>
      }
    </ul>
  `,
  styles: `
    .sc {
      list-style: none;
      margin: 0 0 16px;
      padding: 0;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    li {
      display: grid;
      gap: 4px;
      padding: 14px 16px;
      border: 1px solid var(--c-border);
      border-radius: 12px;
      background: var(--c-surface);
    }
    .l {
      font-size: 0.85rem;
      color: var(--c-muted);
    }
    b {
      font-size: 1.4rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    @media (width <= 1100px) {
      .sc {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class SummaryCards {
  readonly cards = input.required<readonly SummaryCard[]>();
  readonly label = input.required<string>();
}
