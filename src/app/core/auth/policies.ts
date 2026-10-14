/**
 * Staff policies → roles, r4 (11 §1.2 with r4 §2: no `allocation_officer`, so `staff:beneficiaries`, `staff:allocate` and
 * `staff:reveal-pii` are gone). Mirrors the API's `Policies.StaffRoles` — the API stays the authority; this only decides
 * what the admin shows enabled. Segregation of duties (RUL-62): `staff:refund` is `finance` only, never `admin`.
 */
export type StaffRole = 'admin' | 'store_manager' | 'finance' | 'fulfilment' | 'viewer';
export type StaffPolicy =
  | 'staff:read'
  | 'staff:catalogue'
  | 'staff:stock'
  | 'staff:fulfilment'
  | 'staff:finance'
  | 'staff:refund'
  | 'staff:resend'
  | 'staff:admin';

export const STAFF_ROLES: readonly StaffRole[] = [
  'admin',
  'store_manager',
  'finance',
  'fulfilment',
  'viewer',
];

export const POLICY_ROLES: Readonly<Record<StaffPolicy, readonly StaffRole[]>> = {
  'staff:read': STAFF_ROLES,
  'staff:catalogue': ['admin', 'store_manager'],
  'staff:stock': ['admin', 'store_manager', 'fulfilment'],
  'staff:fulfilment': ['admin', 'fulfilment'],
  'staff:finance': ['admin', 'finance'],
  'staff:refund': ['finance'],
  'staff:resend': ['admin', 'finance', 'store_manager'],
  'staff:admin': ['admin'],
};

export function rolesAllow(roles: readonly string[], policy: StaffPolicy): boolean {
  return POLICY_ROLES[policy].some((r) => roles.includes(r));
}
