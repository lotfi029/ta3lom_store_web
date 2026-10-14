import { policyReason } from '../../core/auth/policy-text';
import { groupSecret, safeAdminReturn } from './login/admin-login.page';
import { SETTINGS, fromInput, toInput } from './settings/setting-kinds';
import { previewText } from './templates/templates.page';

const def = (key: string) => SETTINGS.find((s) => s.key === key)!;

describe('admin platform helpers (W-08)', () => {
  it('returns only to same-site admin paths after sign-in', () => {
    expect(safeAdminReturn('/admin/staff')).toBe('/admin/staff');
    expect(safeAdminReturn('//evil.example')).toBe('/admin');
    expect(safeAdminReturn('/admin//evil')).toBe('/admin');
    expect(safeAdminReturn('/account')).toBe('/admin');
    expect(safeAdminReturn('/admin/login')).toBe('/admin');
    expect(safeAdminReturn(undefined)).toBe('/admin');
  });

  it('groups the TOTP setup key in fours', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
  });

  it('settings are typed per key: money strings, integers in range, booleans, text or null', () => {
    expect(fromInput(def('shipping_flat_fee'), '25')).toEqual({ value: '25.00' });
    expect(fromInput(def('shipping_flat_fee'), '٢٥٫٥')).toEqual({ value: '25.50' });
    expect('error' in fromInput(def('shipping_flat_fee'), '25.555')).toBe(true);
    expect('error' in fromInput(def('shipping_flat_fee'), '-1')).toBe(true);
    expect(fromInput(def('vat_rate'), '15')).toEqual({ value: 15 });
    expect('error' in fromInput(def('vat_rate'), '15.5')).toBe(true);
    expect('error' in fromInput(def('vat_rate'), '101')).toBe(true);
    expect(fromInput(def('vat_enabled'), true)).toEqual({ value: true });
    expect(fromInput(def('seller_vat_no'), '  ')).toEqual({ value: null });
    expect(toInput('integer', 5)).toBe('5');
    expect(toInput('text', null)).toBe('');
  });

  it('shows only r4 settings', () => {
    expect(SETTINGS.map((s) => s.key)).not.toContain('min_gift_amount');
  });

  it('previews template variables as [name]', () => {
    expect(previewText('Order {{ reference }} — {{total}}')).toBe('Order [reference] — [total]');
  });

  it('explains disabled actions by the role they need (RUL-62)', () => {
    expect(policyReason('staff:refund')).toBe(policyReason('staff:finance'));
    expect(policyReason('staff:read')).toBe('');
    expect(policyReason('staff:admin')).not.toBe('');
  });
});
