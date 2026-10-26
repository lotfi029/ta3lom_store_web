import { POLICY_ROLES, STAFF_ROLES, rolesAllow } from './policies';

describe('R5 staff policy table (contract 15 §1.6)', () => {
  it('has exactly the four R5 roles', () => {
    expect([...STAFF_ROLES]).toEqual(['admin', 'store_manager', 'finance', 'viewer']);
  });

  it('lets every role read and only admin administer', () => {
    for (const role of STAFF_ROLES) expect(rolesAllow([role], 'staff:read')).toBe(true);
    expect(STAFF_ROLES.filter((r) => rolesAllow([r], 'staff:admin'))).toEqual(['admin']);
  });

  it('matches the catalogue, customers, orders and templates rows', () => {
    const who = (p: Parameters<typeof rolesAllow>[1]) =>
      STAFF_ROLES.filter((r) => rolesAllow([r], p));
    expect(who('staff:catalogue')).toEqual(['admin', 'store_manager']);
    expect(who('staff:customers')).toEqual(['admin', 'store_manager']);
    expect(who('staff:orders')).toEqual(['admin', 'finance']);
    expect(who('staff:templates')).toEqual(['admin', 'store_manager']);
    expect(Object.keys(POLICY_ROLES)).toHaveLength(6);
  });

  it('never lets viewer write', () => {
    for (const p of Object.keys(POLICY_ROLES) as (keyof typeof POLICY_ROLES)[])
      if (p !== 'staff:read') expect(rolesAllow(['viewer'], p)).toBe(false);
  });
});
