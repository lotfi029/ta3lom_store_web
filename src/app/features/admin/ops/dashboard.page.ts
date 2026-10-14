import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toInt } from '../../../core/api/api.types';
import { roleLabel } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { ADMIN_NAV } from '../shell/admin-nav';
import { OpsData } from './ops.data';

/** r4 dashboard alerts (the pre-r4 API also reports allocation alerts, which are giving). */
export const R4_ALERTS = ['outbox.dead', 'integrity.failed'];

export function alertLabel(code: string): string {
  switch (code) {
    case 'outbox.dead':
      return $localize`:@@store.admin.alert-outbox:رسائل تعذّر إرسالها`;
    case 'integrity.failed':
      return $localize`:@@store.admin.alert-integrity:فحوص سلامة البيانات الفاشلة`;
    default:
      return code;
  }
}

/** `/admin` dashboard (#53, FR-S74): sales today / 7 / 30 days, orders awaiting payment, top products, alerts, low stock. */
@Component({
  selector: 'ta-admin-dashboard',
  imports: [RouterLink, Icon, Money, ResourceState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrls: ['../admin-common.css', './dashboard.page.css'],
})
export class DashboardPage {
  protected readonly data = inject(OpsData);
  private readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly d = computed(() => valueOf(this.data.dashboard));
  protected readonly alerts = computed(() =>
    (this.d()?.alerts ?? []).filter((a) => R4_ALERTS.includes(a.code)),
  );
  protected readonly low = computed(() => valueOf(this.data.lowStock) ?? []);
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly links = computed(() =>
    ADMIN_NAV.filter((i) => i.path !== '/admin' && this.auth.can(i.policy)),
  );
  protected readonly int = toInt;
  protected readonly alertLabel = alertLabel;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.home-title:لوحة إدارة المتجر`,
      description: '',
      path: '/admin',
      noindex: true,
    });
    this.data.dashboard.reload();
    this.data.lowStock.reload();
  }
}
