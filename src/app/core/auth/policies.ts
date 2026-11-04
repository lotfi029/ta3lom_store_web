/**
 * Staff policies → roles (contract 15 §1.6). Mirrors the API's `Policies` table — the API stays the authority; this only
 * decides what the admin shows enabled. Every `staff:*` policy also needs no pending password change (`pwd_change`);
 * StaffAuth routes to /admin/password while one is pending.
 */
export type StaffRole = 'admin' | 'store_manager' | 'finance' | 'viewer';
export type StaffPolicy =
  | 'staff:read'
  | 'staff:catalogue'
  | 'staff:customers'
  | 'staff:orders'
  | 'staff:templates'
  | 'staff:admin'
  | 'staff:finance';

export const STAFF_ROLES: readonly StaffRole[] = ['admin', 'store_manager', 'finance', 'viewer'];

export const POLICY_ROLES: Readonly<Record<StaffPolicy, readonly StaffRole[]>> = {
  'staff:read': STAFF_ROLES,
  'staff:catalogue': ['admin', 'store_manager'],
  'staff:customers': ['admin', 'store_manager'],
  'staff:orders': ['admin', 'finance'],
  'staff:templates': ['admin', 'store_manager'],
  'staff:admin': ['admin'],
  /** R5-Payments: refunds, payment review, receipt resend, the donations CSV. */
  'staff:finance': ['admin', 'finance'],
};

export function rolesAllow(roles: readonly string[], policy: StaffPolicy): boolean {
  return POLICY_ROLES[policy].some((r) => roles.includes(r));
}
