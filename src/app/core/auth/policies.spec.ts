import { POLICY_ROLES, STAFF_ROLES, rolesAllow } from './policies';

describe('r4 staff policy table (11 §1.2)', () => {
  it('has no giving roles or policies', () => {
    expect(STAFF_ROLES).not.toContain('allocation_officer');
    expect(Object.keys(POLICY_ROLES)).not.toContain('staff:allocate');
  });

  it('lets every role read and only admin administer', () => {
    for (const role of STAFF_ROLES) expect(rolesAllow([role], 'staff:read')).toBe(true);
    expect(STAFF_ROLES.filter((r) => rolesAllow([r], 'staff:admin'))).toEqual(['admin']);
  });

  it('keeps refunds with finance only — segregation of duties (RUL-62)', () => {
    expect(rolesAllow(['admin'], 'staff:refund')).toBe(false);
    expect(rolesAllow(['finance'], 'staff:refund')).toBe(true);
  });

  it('cancels (staff:finance) for admin and finance, never for store_manager, fulfilment or viewer', () => {
    expect(rolesAllow(['admin'], 'staff:finance')).toBe(true);
    expect(rolesAllow(['finance'], 'staff:finance')).toBe(true);
    for (const role of ['store_manager', 'fulfilment', 'viewer']) expect(rolesAllow([role], 'staff:finance')).toBe(false);
  });

  it('matches the catalogue, stock, fulfilment and resend rows', () => {
    const who = (p: Parameters<typeof rolesAllow>[1]) => STAFF_ROLES.filter((r) => rolesAllow([r], p));
    expect(who('staff:catalogue')).toEqual(['admin', 'store_manager']);
    expect(who('staff:stock')).toEqual(['admin', 'store_manager', 'fulfilment']);
    expect(who('staff:fulfilment')).toEqual(['admin', 'fulfilment']);
    expect(who('staff:resend')).toEqual(['admin', 'store_manager', 'finance']);
    expect(rolesAllow(['viewer', 'fulfilment'], 'staff:fulfilment')).toBe(true);
  });
});
