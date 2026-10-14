import type { IconName } from '../../../shared/ui/icon/icon.data';
import type { StaffPolicy } from '../../../core/auth/policies';

export interface AdminNavItem {
  path: string;
  label: () => string;
  icon: IconName;
  /** Policy needed to see the screen (10 §16.2); actions inside check their own. */
  policy: StaffPolicy;
}

/** The side navigation (10 §16.2), r4 screens only. Filtered by `StaffAuth.can()`. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    path: '/admin',
    label: () => $localize`:@@store.admin.nav-home:الرئيسية`,
    icon: 'grid',
    policy: 'staff:read',
  },
  {
    path: '/admin/staff',
    label: () => $localize`:@@store.admin.nav-staff:فريق العمل`,
    icon: 'users',
    policy: 'staff:admin',
  },
  {
    path: '/admin/settings',
    label: () => $localize`:@@store.admin.nav-settings:الإعدادات`,
    icon: 'settings',
    policy: 'staff:read',
  },
  {
    path: '/admin/templates',
    label: () => $localize`:@@store.admin.nav-templates:قوالب الرسائل`,
    icon: 'mail',
    policy: 'staff:read',
  },
  {
    path: '/admin/audit',
    label: () => $localize`:@@store.admin.nav-audit:سجل التدقيق`,
    icon: 'file',
    policy: 'staff:admin',
  },
];
