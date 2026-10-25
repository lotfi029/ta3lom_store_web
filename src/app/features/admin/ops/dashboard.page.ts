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

/**
 * `/admin` (contract 15 §2.8): published projects, active categories, active donors, pending donations today and this
 * week, and the top five projects by pending amount (R5-Core has no payments yet, so "pending" is all there is).
 */
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
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly links = computed(() =>
    ADMIN_NAV.filter((i) => i.path !== '/admin' && this.auth.can(i.policy)),
  );
  protected readonly int = toInt;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.home-title:لوحة إدارة المتجر`,
      description: '',
      path: '/admin',
      noindex: true,
    });
    this.data.dashboard.reload();
  }
}
