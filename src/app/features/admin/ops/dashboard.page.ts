import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type DashboardProject, toInt } from '../../../core/api/api.types';
import { StoreConfig } from '../../../core/api/store-config';
import { roleLabel } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { toHalalas } from '../../../core/money/money';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { CatalogAdminData } from '../catalog/catalog-admin.data';
import { PlatformData } from '../platform.data';
import { Requires } from '../ui/requires';
import { OpsData } from './ops.data';

/** Bar widths for «أعلى المشاريع بالمبالغ المعلّقة»: percent of the largest pending amount, in integer halalas. */
export function barWidths(rows: readonly Pick<DashboardProject, 'pendingAmount'>[]): number[] {
  const h = rows.map((r) => toHalalas(r.pendingAmount));
  const max = Math.max(0, ...h);
  return h.map((v) => (max > 0 ? Math.max(2, Math.round((v * 100) / max)) : 0));
}

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  link?: string;
  queryParams?: Record<string, string>;
}

/** «جاهزية المتجر»: only checks the API can answer (03 §7); a check whose data is missing is left out. */
export function readiness(input: {
  activeCategories: number | null;
  drafts: number | null;
  paymentsEnabled: boolean | null;
  staffCount: number | null;
}): ReadinessItem[] {
  const out: ReadinessItem[] = [];
  if (input.activeCategories !== null)
    out.push({
      key: 'categories',
      label: $localize`:@@store.admin.ready-categories:أنشئ التصنيفات وفعّلها`,
      done: input.activeCategories > 0,
      link: '/admin/categories',
    });
  if (input.drafts !== null)
    out.push({
      key: 'drafts',
      label: $localize`:@@store.admin.ready-drafts:أكمل المشاريع المسودة وانشرها`,
      done: input.drafts === 0,
      link: '/admin/projects',
      queryParams: { status: 'draft' },
    });
  if (input.paymentsEnabled !== null)
    out.push({
      key: 'payments',
      label: $localize`:@@store.admin.ready-payments:اربط بوابة الدفع`,
      done: input.paymentsEnabled,
    });
  if (input.staffCount !== null)
    out.push({
      key: 'team',
      label: $localize`:@@store.admin.ready-team:أضف الفريق وصلاحياته`,
      done: input.staffCount > 1,
      link: '/admin/staff',
    });
  return out;
}

/**
 * `/admin` (docs/admin-redesign/03 §7, mockups D/T/P-Home): greeting, the showcase notice, four metrics, the top
 * projects by pending amount as bars, the store readiness checklist, today's tasks and the latest audit entries
 * (admins). Data: `GET /v1/admin/dashboard` + counts the API already has; no chart (no time series) and no invented
 * numbers. The paid totals (R5-Payments) stay, shown only when the API returns them.
 */
@Component({
  selector: 'ta-admin-dashboard',
  imports: [RouterLink, Icon, Money, ResourceState, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrls: ['../admin-common.css', './dashboard.page.css'],
})
export class DashboardPage {
  protected readonly data = inject(OpsData);
  private readonly catalog = inject(CatalogAdminData);
  private readonly platform = inject(PlatformData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  /** SW-6: the API runs in showcase mode (payments off) — said on the dashboard; finance screens stay reachable. */
  private readonly config = inject(StoreConfig);
  protected readonly paymentsOff = computed(() => this.config.paymentsEnabled() === false);

  protected readonly d = computed(() => valueOf(this.data.dashboard));
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly name = computed(() => this.auth.staff()?.name ?? '');
  protected readonly today = this.i18n.formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Riyadh',
  });
  protected readonly int = toInt;
  protected readonly isAdmin = computed(() => this.auth.can('staff:admin'));
  protected readonly canCreate = computed(() => this.auth.can('staff:catalogue'));

  protected readonly bars = computed(() => barWidths(this.d()?.topProjectsByPendingAmount ?? []));
  private readonly drafts = computed(() => {
    const v = valueOf(this.catalog.draftTotal);
    return v ? toInt(v.total) : null;
  });
  protected readonly draftCount = this.drafts;
  protected readonly ready = computed(() => {
    const d = this.d();
    const staff = this.isAdmin() ? valueOf(this.platform.staff) : undefined;
    return readiness({
      activeCategories: d ? toInt(d.activeCategories) : null,
      drafts: this.drafts(),
      paymentsEnabled: this.config.paymentsEnabled(),
      staffCount: staff ? staff.length : null,
    });
  });
  protected readonly readyDone = computed(() => this.ready().filter((r) => r.done).length);
  protected readonly recent = computed(() =>
    this.isAdmin() ? (valueOf(this.platform.recentAudit)?.items ?? []) : [],
  );

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.home-title:لوحة إدارة المتجر`,
      description: '',
      path: '/admin',
      noindex: true,
    });
    this.data.dashboard.reload();
    this.catalog.draftTotal.reload();
    if (this.isAdmin()) {
      this.platform.staff.reload();
      this.platform.recentAudit.reload();
    }
  }
}
