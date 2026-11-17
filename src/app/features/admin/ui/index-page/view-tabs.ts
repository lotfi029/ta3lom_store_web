import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ViewTab {
  key: string;
  label: string;
  /** A count from the API (paged total); null = not shown. */
  count?: number | null;
}

/**
 * Status views above an index table (02 §2: «الكل · منشور · مسودة · مؤرشف»). Buttons with `aria-pressed` — they filter
 * the list below; they are not ARIA tabs (there is one panel, the list).
 */
@Component({
  selector: 'ta-view-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vt" role="group" [attr.aria-label]="label()">
      @for (t of tabs(); track t.key) {
        <button
          type="button"
          [attr.aria-pressed]="t.key === active()"
          [class.on]="t.key === active()"
          (click)="selected.emit(t.key)"
        >
          {{ t.label }}
          @if (t.count !== null && t.count !== undefined) {
            <span class="n">{{ t.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .vt {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 14px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--c-muted);
      font: inherit;
      font-size: 0.9rem;
      white-space: nowrap;
      cursor: pointer;
    }
    button:hover {
      color: var(--c-text);
      background: var(--c-surface-2);
    }
    button.on {
      background: var(--c-surface-2);
      color: var(--c-text);
      font-weight: 600;
    }
    .n {
      min-inline-size: 20px;
      padding-inline: 6px;
      border-radius: 999px;
      background: var(--c-badge-draft-bg);
      color: var(--c-badge-draft-text);
      font-size: 0.72rem;
      text-align: center;
    }
  `,
})
export class ViewTabs {
  readonly tabs = input.required<readonly ViewTab[]>();
  readonly active = input.required<string>();
  readonly label = input.required<string>();
  readonly selected = output<string>();
}
