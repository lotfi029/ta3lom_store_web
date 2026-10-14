import { rolesAllow } from '../../../core/auth/policies';
import { lookupQuery } from './customers.page';
import { R4_ALERTS } from './dashboard.page';
import { CANCELLABLE } from './order.page';
import { lastDays, riyadhDay } from './reports.page';
import { parseDelta } from './stock.page';

describe('admin operations helpers (W-10)', () => {
  it('stock deltas are non-zero whole numbers, Arabic-Indic digits accepted', () => {
    expect(parseDelta('25')).toBe(25);
    expect(parseDelta('-٣')).toBe(-3);
    expect(parseDelta('0')).toBeNull();
    expect(parseDelta('1.5')).toBeNull();
    expect(parseDelta('')).toBeNull();
  });

  it('customer lookup is exact: a Saudi mobile or an email, nothing else', () => {
    expect(lookupQuery('٠٥٥١٢٣٤٥٦٧')).toEqual({ mobile: '0551234567' });
    expect(lookupQuery('+966551234567')).toEqual({ mobile: '0551234567' });
    expect(lookupQuery('noura@example.com')).toEqual({ email: 'noura@example.com' });
    expect(lookupQuery('noura')).toBeNull();
  });

  it('report days are Riyadh days; the default range is the last 30 days', () => {
    expect(riyadhDay(new Date('2026-10-13T22:30:00Z'))).toBe('2026-10-14');
    expect(lastDays(30, new Date('2026-10-14T09:00:00Z'))).toEqual({
      from: '2026-09-15',
      to: '2026-10-14',
    });
  });

  it('only unpaid orders can be cancelled, by staff:finance (admin or finance; never store manager) (RUL-29, RUL-62)', () => {
    expect(CANCELLABLE).toEqual(['pending_payment', 'payment_failed']);
    expect(rolesAllow(['store_manager'], 'staff:finance')).toBe(false);
    expect(rolesAllow(['finance'], 'staff:finance')).toBe(true);
  });

  it('the dashboard shows no giving alerts (r4)', () => {
    expect(R4_ALERTS.some((a) => a.startsWith('allocation'))).toBe(false);
  });
});
