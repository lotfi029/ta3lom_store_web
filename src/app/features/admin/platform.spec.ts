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

  it('settings are typed per R5 key: money strings, money lists, integers in range, text or null, mobile', () => {
    expect(fromInput(def('min_gift_amount'), '10')).toEqual({ value: '10.00' });
    expect(fromInput(def('min_gift_amount'), '٢٥٫٥')).toEqual({ value: '25.50' });
    expect('error' in fromInput(def('min_gift_amount'), '25.555')).toBe(true);
    expect('error' in fromInput(def('min_gift_amount'), '0')).toBe(true);
    expect('error' in fromInput(def('cart_max_total'), '100000.01')).toBe(true);
    expect(fromInput(def('amount_presets'), '50, 100،500')).toEqual({
      value: ['50.00', '100.00', '500.00'],
    });
    expect('error' in fromInput(def('amount_presets'), '1,2,3,4,5,6,7')).toBe(true);
    expect(fromInput(def('cart_max_lines'), '50')).toEqual({ value: 50 });
    expect('error' in fromInput(def('cart_max_lines'), '51')).toBe(true);
    expect('error' in fromInput(def('payment_window_minutes'), '4')).toBe(true);
    expect(fromInput(def('site_name_en'), '  ')).toEqual({ value: null });
    expect(fromInput(def('support_mobile'), '0551234567')).toEqual({ value: '+966551234567' });
    expect(toInput('mobile', '+966551234567')).toBe('0551234567');
    expect(toInput('money-list', ['50.00', '100.00'])).toBe('50.00, 100.00');
    expect(toInput('text', null)).toBe('');
  });

  it('shows exactly the R5 settings', () => {
    expect(SETTINGS.map((s) => s.key)).toEqual([
      'min_gift_amount',
      'max_line_amount',
      'cart_max_total',
      'cart_max_lines',
      'payment_window_minutes',
      'amount_presets',
      'site_name_ar',
      'site_name_en',
      'support_mobile',
    ]);
  });

  it('previews template variables as [name]', () => {
    expect(previewText('Order {{ reference }} — {{total}}')).toBe('Order [reference] — [total]');
  });

  it('explains disabled actions by the role they need', () => {
    expect(policyReason('staff:orders')).not.toBe(policyReason('staff:catalogue'));
    expect(policyReason('staff:read')).toBe('');
    expect(policyReason('staff:admin')).not.toBe('');
  });
});
