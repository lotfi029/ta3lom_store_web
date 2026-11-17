import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STAFF_ROLES, type StaffPolicy } from '../../../core/auth/policies';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import type { IconName } from '../../../shared/ui/icon/icon.data';
import { PlatformData } from '../platform.data';
import { Requires } from '../ui/requires';

interface SettingsCard {
  key: string;
  path: string;
  icon: IconName;
  title: string;
  text: string;
  /** Null = every staff member (their own password). */
  policy: StaffPolicy | null;
}

/**
 * `/admin/settings` (docs/admin-redesign/03 §8, mockup D-Settings): the index of the platform screens — team and
 * roles, store settings (`/admin/settings/store`), message templates, audit log, password and 2FA. A card the user's
 * roles do not allow stays visible, disabled, with the `<ta-requires>` reason.
 */
@Component({
  selector: 'ta-admin-settings-home',
  imports: [RouterLink, Icon, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-home.page.html',
  styleUrls: ['../admin-common.css', './settings-home.page.css'],
})
export class SettingsHomePage {
  protected readonly auth = inject(StaffAuth);
  private readonly platform = inject(PlatformData);
  private readonly seo = inject(SeoService);

  private readonly staffCount = computed(() => valueOf(this.platform.staff)?.length ?? null);

  protected readonly cards = computed<SettingsCard[]>(() => {
    const n = this.staffCount();
    return [
      {
        key: 'team',
        path: '/admin/staff',
        icon: 'users',
        title: $localize`:@@store.admin.card-team:الفريق والصلاحيات`,
        text:
          n === null
            ? $localize`:@@store.admin.card-team-text:الأعضاء والأدوار والتحقق الثنائي`
            : $localize`:@@store.admin.card-team-count:${n}:count: أعضاء · ${STAFF_ROLES.length}:roles: أدوار`,
        policy: 'staff:admin',
      },
      {
        key: 'store',
        path: '/admin/settings/store',
        icon: 'settings',
        title: $localize`:@@store.admin.settings-store:إعدادات المتجر`,
        text: $localize`:@@store.admin.card-store-text:حدود المبالغ، المبالغ المقترحة، مهلة الدفع`,
        policy: 'staff:admin',
      },
      {
        key: 'templates',
        path: '/admin/templates',
        icon: 'mail',
        title: $localize`:@@store.admin.nav-templates:قوالب الرسائل`,
        text: $localize`:@@store.admin.card-templates-text:SMS والبريد بالعربية والإنجليزية`,
        policy: 'staff:templates',
      },
      {
        key: 'audit',
        path: '/admin/audit',
        icon: 'shield',
        title: $localize`:@@store.admin.nav-audit:سجل التدقيق`,
        text: $localize`:@@store.admin.card-audit-text:كل عمليات الفريق`,
        policy: 'staff:admin',
      },
      {
        key: 'password',
        path: '/admin/password',
        icon: 'lock',
        title: $localize`:@@store.admin.account-security:كلمة المرور والتحقق`,
        text: $localize`:@@store.admin.card-password-text:حسابك`,
        policy: null,
      },
    ];
  });

  protected allowed(c: SettingsCard): boolean {
    return !c.policy || this.auth.can(c.policy);
  }

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-settings-team:الإعدادات والفريق`,
      description: '',
      path: '/admin/settings',
      noindex: true,
    });
    this.platform.staff.reload();
  }
}
