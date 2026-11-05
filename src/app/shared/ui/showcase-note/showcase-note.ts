import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Showcase mode (SW-2): «التبرع الإلكتروني قريبًا» in place of the donate controls (`inline`, card and project page) and
 * under the home hero (`banner`, with one more sentence). Presentational; the caller decides when to show it.
 */
@Component({
  selector: 'ta-showcase-note',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="note" [class.banner]="variant() === 'banner'" role="note">
      <ta-icon name="clock" [size]="18" />
      <span>
        <strong i18n="@@store.showcase.note">التبرع الإلكتروني قريبًا</strong>
        @if (variant() === 'banner') {
          <span class="more" i18n="@@store.showcase.banner-more"
            >تعرّف على مشاريعنا وخياراتها الآن، وسنفتح التبرع عبر المتجر قريبًا.</span
          >
        }
      </span>
    </p>
  `,
  styles: `
    .note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      padding-block: 10px;
      padding-inline: 12px;
      border-radius: var(--r);
      background: var(--c-tint);
      color: var(--c-accent-strong);
      font-size: 0.9rem;
    }
    .note ta-icon {
      flex: none;
      margin-block-start: 3px;
    }
    .banner {
      padding-block: 14px;
      padding-inline: 16px;
      font-size: 1rem;
    }
    .more {
      display: block;
      font-size: 0.9rem;
    }
  `,
})
export class ShowcaseNote {
  readonly variant = input<'inline' | 'banner'>('inline');
}
