import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { QuickDonate } from '../../../core/ui/quick-donate.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { QuickDonateData } from './quick-donate.data';
import { QuickDonateForm } from './quick-donate-form';

/**
 * Quick donate ("تبرع سريع", M-5): a modal around `ta-quick-donate-form` (categories that accept general gifts, amount
 * presets from `/catalog/config` plus a custom amount, **تبرع الآن** → `POST /v1/cart/lines { categoryId, amount }` →
 * checkout). Native `<dialog>` (focus trap, Escape, focus back to the opener). The home page shows the same form
 * inline (Option C §3 row 4).
 */
@Component({
  selector: 'ta-quick-donate',
  imports: [Dialog, Icon, QuickDonateForm],
  providers: [QuickDonateData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-dialog [open]="qd.open()" labelledBy="qd-h" [lightDismiss]="false" (closed)="close()">
      <div class="qd">
        <div class="hd">
          <h2 id="qd-h">
            <ta-icon name="gift" [size]="22" /><span i18n="@@store.quick.title">تبرع سريع</span>
          </h2>
          <button
            type="button"
            class="x"
            (click)="close()"
            aria-label="إغلاق"
            i18n-aria-label="@@store.ui.close"
          >
            <ta-icon name="close" [size]="20" />
          </button>
        </div>
        <p class="lede" i18n="@@store.quick.lede">تبرّع لتصنيف عام، ويُصرف تبرعك على مشاريعه.</p>
        @if (data.categories.hasValue() && data.list().length === 0) {
          <p class="lede" role="status" i18n="@@store.quick.unavailable">
            التبرع العام غير متاح حاليًا.
          </p>
        } @else {
          <ta-quick-donate-form [list]="data.list()" idPrefix="qd" (added)="qd.open.set(false)" />
        }
      </div>
    </ta-dialog>
  `,
  styles: `
    .qd {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5);
      inline-size: min(440px, 92vw);
      background: var(--c-surface);
      color: var(--c-text);
    }
    .hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 1.2rem;
      margin: 0;
    }
    .x {
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border: 0;
      background: none;
      color: var(--c-muted);
      cursor: pointer;
    }
    .lede {
      margin: 0;
      color: var(--c-muted);
      font-size: 0.9rem;
    }
  `,
})
export class QuickDonateModal {
  protected readonly qd = inject(QuickDonate);
  protected readonly data = inject(QuickDonateData);

  protected close(): void {
    this.qd.hide();
  }
}
