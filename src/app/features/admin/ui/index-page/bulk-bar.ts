import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Shown while rows are selected (02 §2): «تم تحديد N» + the projected actions. Hidden on phones (02 §3). Live region,
 * so the count is announced.
 */
@Component({
  selector: 'ta-bulk-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bb" role="region" [attr.aria-label]="label()">
      <span class="n" aria-live="polite" i18n="@@store.admin.bulk-selected"
        >تم تحديد {{ count() }}</span
      >
      <div class="acts"><ng-content /></div>
    </div>
  `,
  styles: `
    .bb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px 16px;
      padding-block: 8px;
      padding-inline: 16px;
      background: var(--c-surface-2);
      border-block-end: 1px solid var(--c-border);
    }
    .n {
      font-weight: 600;
      font-size: 0.9rem;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    @media (width <= 640px) {
      .bb {
        display: none;
      }
    }
  `,
})
export class BulkBar {
  readonly count = input.required<number>();
  readonly label = input.required<string>();
}
