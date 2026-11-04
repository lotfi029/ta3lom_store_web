import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Icon } from '../../../shared/ui/icon/icon';
import type { IconName } from '../../../shared/ui/icon/icon.data';

export interface TrustFlags {
  showZakat: boolean;
  showUpdates: boolean;
}

interface TrustItem {
  key: 'licensed' | 'receipt' | 'zakat' | 'updates';
  icon: IconName;
  title: string;
  text: string;
}

/** The items to show (Option C §3 row 8): licensed and receipt always; zakat and updates only behind their flags. */
export function trustItems(flags: TrustFlags): TrustItem[] {
  const all: TrustItem[] = [
    {
      key: 'licensed',
      icon: 'shield',
      title: $localize`:@@store.home.trust-licensed:جمعية مرخّصة`,
      text: $localize`:@@store.home.trust-licensed-text:ترخيص رقم [رقم الترخيص]`,
    },
    {
      key: 'receipt',
      icon: 'receipt',
      title: $localize`:@@store.home.trust-receipt:إيصال فوري`,
      text: $localize`:@@store.home.trust-receipt-text:برسالة نصية بعد الدفع`,
    },
    {
      key: 'zakat',
      icon: 'coins',
      title: $localize`:@@store.home.trust-zakat:زكاة مستقلة`,
      text: $localize`:@@store.home.trust-zakat-text:سجل خاص لأموال الزكاة`,
    },
    {
      key: 'updates',
      icon: 'pulse',
      title: $localize`:@@store.home.trust-updates:تحديثات التنفيذ`,
      text: $localize`:@@store.home.trust-updates-text:تابع أثر تبرعك`,
    },
  ];
  return all.filter(
    (i) => (i.key !== 'zakat' || flags.showZakat) && (i.key !== 'updates' || flags.showUpdates),
  );
}

/**
 * Trust row (Option C §3 row 8). "زكاة مستقلة" stays hidden while zakat is dormant and "تحديثات التنفيذ" until updates
 * exist: flags in the environment, both off by default (owner M-3; REVIEW — move to `/catalog/config` later).
 */
@Component({
  selector: 'ta-trust-row',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="trust" aria-label="لماذا تتبرع معنا" i18n-aria-label="@@store.home.trust-label">
      <ul class="row">
        @for (i of items(); track i.key) {
          <li>
            <span class="ic" aria-hidden="true"><ta-icon [name]="i.icon" [size]="20" /></span>
            <span class="tx"
              ><strong>{{ i.title }}</strong
              ><span class="sub">{{ i.text }}</span></span
            >
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host {
      display: block;
      background: var(--c-surface);
      border-block-start: 1px solid var(--c-border);
    }
    .trust {
      padding-block: var(--space-7);
    }
    .row {
      list-style: none;
      margin: 0 auto;
      max-width: 1200px;
      padding-inline: var(--space-6);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-5);
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .ic {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--r);
      background: var(--c-tint);
      color: var(--c-link);
    }
    .tx {
      display: grid;
    }
    strong {
      font-size: 1rem;
    }
    .sub {
      font-size: 0.85rem;
      color: var(--c-muted);
    }
    @media (width < 600px) {
      .row {
        padding-inline: var(--space-4);
      }
    }
  `,
})
export class TrustRow {
  readonly flags = input<TrustFlags>(environment.trust);
  protected readonly items = computed(() => trustItems(this.flags()));
}
