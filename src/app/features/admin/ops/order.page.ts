import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { upperRef } from './ops.data';
import { OrderDetail } from './order-detail';

/**
 * `/admin/orders/:ref` — the full donation page (tablets, phones, deep links); the same `ta-order-detail` as the side
 * panel of `/admin/orders` (W-A4).
 */
@Component({
  selector: 'ta-admin-order',
  imports: [RouterLink, Icon, OrderDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="back">
      <a routerLink="/admin/orders">
        <ta-icon name="chevron" [size]="16" class="flip" />
        <span i18n="@@store.admin.back-to-donations">العودة إلى التبرعات</span>
      </a>
    </p>
    <ta-order-detail [ref]="ref()" />
  `,
  styles: `
    .back {
      margin: 0 0 8px;
    }
    .back a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 44px;
      color: var(--c-link);
    }
    .flip {
      transform: scaleX(-1);
    }
  `,
})
export class AdminOrderPage {
  readonly ref = input.required<string>();
  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const ref = upperRef(this.ref());
      this.seo.set({ title: ref, description: '', path: `/admin/orders/${ref}`, noindex: true });
    });
  }
}
