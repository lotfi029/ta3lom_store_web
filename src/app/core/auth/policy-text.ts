import type { StaffPolicy, StaffRole } from './policies';

/** A staff role's name as shown in the admin. */
export function roleLabel(role: string): string {
  switch (role as StaffRole) {
    case 'admin':
      return $localize`:@@store.admin.role-admin:مدير النظام`;
    case 'store_manager':
      return $localize`:@@store.admin.role-store-manager:مدير المتجر`;
    case 'finance':
      return $localize`:@@store.admin.role-finance:المالية`;
    case 'fulfilment':
      return $localize`:@@store.admin.role-fulfilment:التجهيز والشحن`;
    case 'viewer':
      return $localize`:@@store.admin.role-viewer:اطّلاع فقط`;
    default:
      return role;
  }
}

/**
 * Why an action is disabled (10 §16.1): the role it needs, so segregation of duties is visible rather than silent.
 * Empty for `staff:read`, which every staff role holds.
 */
export function policyReason(policy: StaffPolicy): string {
  switch (policy) {
    case 'staff:admin':
      return $localize`:@@store.admin.requires-admin:يتطلب دور مدير النظام`;
    case 'staff:catalogue':
      return $localize`:@@store.admin.requires-catalogue:يتطلب دور مدير المتجر`;
    case 'staff:stock':
      return $localize`:@@store.admin.requires-stock:يتطلب دور مدير المتجر أو التجهيز والشحن`;
    case 'staff:fulfilment':
      return $localize`:@@store.admin.requires-fulfilment:يتطلب دور التجهيز والشحن`;
    case 'staff:finance':
    case 'staff:refund':
      return $localize`:@@store.admin.requires-finance:يتطلب دور المالية`;
    case 'staff:resend':
      return $localize`:@@store.admin.requires-resend:يتطلب دور مدير المتجر أو المالية`;
    default:
      return '';
  }
}
