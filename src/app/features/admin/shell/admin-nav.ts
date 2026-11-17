import type { Params } from '@angular/router';
import type { StaffPolicy } from '../../../core/auth/policies';
import type { IconName } from '../../../shared/ui/icon/icon.data';

/** A live count shown next to a nav item (AdminShellData), read from `GET /v1/admin/dashboard`. */
export type AdminNavBadge = 'pendingToday' | 'inReview' | 'orphans';

export interface AdminNavItem {
  key: string;
  path: string;
  label: () => string;
  icon: IconName;
  /** Policy needed to see the screen (10 §16.2); actions inside check their own. */
  policy: StaffPolicy;
  queryParams?: Params;
  badge?: AdminNavBadge;
  /** Sub-items, shown under the item while its screen is open (wide screens and the phone menu). */
  children?: readonly AdminNavItem[];
}

export interface AdminNavSection {
  key: string;
  /** Section heading; the first section has none. */
  label?: () => string;
  items: readonly AdminNavItem[];
}

/** Admin side navigation (docs/admin-redesign/02 §2, 03 §13.6). Filtered by `StaffAuth.can()` in `visibleNav()`. */
export const ADMIN_SECTIONS: readonly AdminNavSection[] = [
  {
    key: 'main',
    items: [
      {
        key: 'home',
        path: '/admin',
        label: () => $localize`:@@store.admin.nav-home:الرئيسية`,
        icon: 'home',
        policy: 'staff:read',
      },
      {
        key: 'orders',
        path: '/admin/orders',
        label: () => $localize`:@@store.admin.nav-donations:التبرعات`,
        icon: 'inbox',
        policy: 'staff:read',
        badge: 'pendingToday',
        children: [
          {
            key: 'orders-all',
            path: '/admin/orders',
            label: () => $localize`:@@store.admin.nav-donations-all:كل التبرعات`,
            icon: 'inbox',
            policy: 'staff:read',
          },
          {
            key: 'orders-pending',
            path: '/admin/orders',
            queryParams: { status: 'pending_payment' },
            label: () => $localize`:@@store.admin.nav-donations-pending:بانتظار الدفع`,
            icon: 'clock',
            policy: 'staff:read',
            badge: 'pendingToday',
          },
          {
            key: 'orders-review',
            path: '/admin/orders',
            queryParams: { status: 'payment_review' },
            label: () => $localize`:@@store.admin.nav-donations-review:قيد المراجعة`,
            icon: 'alert',
            policy: 'staff:read',
            badge: 'inReview',
          },
          {
            key: 'orders-paid',
            path: '/admin/orders',
            queryParams: { status: 'paid' },
            label: () => $localize`:@@store.admin.nav-donations-paid:مدفوعة`,
            icon: 'check',
            policy: 'staff:read',
          },
        ],
      },
      {
        key: 'projects',
        path: '/admin/projects',
        label: () => $localize`:@@store.admin.nav-projects:المشاريع`,
        icon: 'heart',
        policy: 'staff:read',
        children: [
          {
            key: 'projects-all',
            path: '/admin/projects',
            label: () => $localize`:@@store.admin.nav-projects-all:كل المشاريع`,
            icon: 'heart',
            policy: 'staff:read',
          },
          {
            key: 'categories',
            path: '/admin/categories',
            label: () => $localize`:@@store.admin.nav-categories:التصنيفات`,
            icon: 'tag',
            policy: 'staff:read',
          },
        ],
      },
      {
        key: 'media',
        path: '/admin/media',
        label: () => $localize`:@@store.admin.nav-media:الوسائط`,
        icon: 'image',
        policy: 'staff:read',
      },
      {
        key: 'donors',
        path: '/admin/donors',
        label: () => $localize`:@@store.admin.nav-donors:المتبرعون`,
        icon: 'users',
        policy: 'staff:read',
      },
    ],
  },
  {
    key: 'finance',
    label: () => $localize`:@@store.admin.nav-section-finance:المالية`,
    items: [
      {
        key: 'reports',
        path: '/admin/reports',
        label: () => $localize`:@@store.admin.nav-reports:التقارير`,
        icon: 'chart',
        policy: 'staff:finance',
      },
      {
        key: 'orphans',
        path: '/admin/payments/orphans',
        label: () => $localize`:@@store.admin.nav-orphans:دفعات بلا طلب`,
        icon: 'coins',
        policy: 'staff:finance',
        badge: 'orphans',
      },
    ],
  },
  {
    key: 'admin',
    label: () => $localize`:@@store.admin.nav-section-admin:الإدارة`,
    items: [
      {
        key: 'templates',
        path: '/admin/templates',
        label: () => $localize`:@@store.admin.nav-templates:قوالب الرسائل`,
        icon: 'mail',
        policy: 'staff:templates',
      },
      {
        key: 'audit',
        path: '/admin/audit',
        label: () => $localize`:@@store.admin.nav-audit:سجل التدقيق`,
        icon: 'shield',
        policy: 'staff:admin',
      },
      {
        key: 'settings',
        path: '/admin/settings',
        label: () => $localize`:@@store.admin.nav-settings-team:الإعدادات والفريق`,
        icon: 'settings',
        policy: 'staff:admin',
        children: [
          {
            key: 'settings-all',
            path: '/admin/settings',
            label: () => $localize`:@@store.admin.settings-overview:نظرة عامة`,
            icon: 'settings',
            policy: 'staff:admin',
          },
          {
            key: 'staff',
            path: '/admin/staff',
            label: () => $localize`:@@store.admin.nav-staff:فريق العمل`,
            icon: 'users',
            policy: 'staff:admin',
          },
          {
            key: 'settings-store',
            path: '/admin/settings/store',
            label: () => $localize`:@@store.admin.settings-store:إعدادات المتجر`,
            icon: 'settings',
            policy: 'staff:admin',
          },
        ],
      },
    ],
  },
];

/** The sections and items (and sub-items) the staff user may read; empty sections are left out. */
export function visibleNav(
  can: (policy: StaffPolicy) => boolean,
  sections: readonly AdminNavSection[] = ADMIN_SECTIONS,
): AdminNavSection[] {
  return sections
    .map((s) => ({
      ...s,
      items: s.items
        .filter((i) => can(i.policy))
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => can(c.policy)) } : i)),
    }))
    .filter((s) => s.items.length > 0);
}
