import type { AdminOrderLine } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { lineTitle, refundAmount, refundReady } from './order.page';
import { daySpan, REPORT_MAX_DAYS, riyadhDate, validRange } from '../reports/reports.page';
import { orderParams, upperRef } from './ops.data';
import { rangeOk } from './orders.page';
import { validNote } from './orphans.page';
import { refundSource, refundStatus, reviewReason } from '../../../shared/ui/status-pill/status-labels';

const line = (o: Partial<AdminOrderLine>): AdminOrderLine => ({
  lineNo: 1,
  targetKind: 'project',
  projectId: 'p',
  categoryId: null,
  optionId: null,
  titleAr: 'بئر',
  titleEn: 'Well',
  optionLabelAr: null,
  quantity: 1,
  unitAmount: '10.00',
  amount: '10.00',
  ...o,
});

describe('admin operations', () => {
  it('order search: canonical upper-case reference, blank fields dropped', () => {
    expect(upperRef(' t3-26-000001 ')).toBe('T3-26-000001');
    expect(
      orderParams({
        reference: 't3-26-1',
        mobile: ' ',
        status: 'pending_payment',
        from: '2026-10-01',
        to: '',
        page: 2,
      }),
    ).toEqual({
      page: 2,
      pageSize: 20,
      reference: 'T3-26-1',
      status: 'pending_payment',
      from: '2026-10-01',
    });
    expect(rangeOk('2026-10-02', '2026-10-01')).toBe(false);
    expect(rangeOk('2026-10-01', '')).toBe(true);
  });

  it('lines: option label, or a general gift to a category', () => {
    const pick = (ar: string) => ar;
    expect(lineTitle(line({ optionLabelAr: 'سهم' }), pick)).toBe('بئر — سهم');
    expect(lineTitle(line({ targetKind: 'category', titleAr: 'سقيا' }), pick)).toContain('سقيا');
    expect(lineTitle(line({}), pick)).toBe('بئر');
  });

  it('a cancel refused for the order state is told from its code', () => {
    const msg = problemMessage({
      status: 409,
      code: 'order.cancel_not_allowed',
      extra: { orderStatus: 'cancelled' },
    });
    expect(msg).toContain('إلغاء');
  });

  it('refund dialog: amount within (0, refundable], two decimals; ready only with a reason and the typed reference', () => {
    expect(refundAmount('10', '50.00')).toBe('10.00');
    expect(refundAmount('50.00', '50.00')).toBe('50.00');
    expect(refundAmount('50.01', '50.00')).toBeNull();
    expect(refundAmount('0', '50.00')).toBeNull();
    expect(refundAmount('-1', '50.00')).toBeNull();
    expect(refundAmount('abc', '50.00')).toBeNull();
    expect(refundAmount('١٠٫٥', '50.00')).toBe('10.50');
    expect(refundReady('10.00', 'duplicate', ' t3-26-000001 ', 'T3-26-000001')).toBe(true);
    expect(refundReady('10.00', ' ', 'T3-26-000001', 'T3-26-000001')).toBe(false);
    expect(refundReady('10.00', 'x', 'T3-26-000002', 'T3-26-000001')).toBe(false);
    expect(refundReady(null, 'x', 'T3-26-000001', 'T3-26-000001')).toBe(false);
  });

  it('a refund over the refundable amount is told from its code', () => {
    expect(problemMessage({ status: 422, code: 'payment.refund_exceeds', extra: {} })).not.toBe('');
  });

  it('reports: Riyadh dates, inclusive ranges of at most 366 days', () => {
    expect(riyadhDate(new Date('2026-11-03T21:30:00Z'))).toBe('2026-11-04');
    expect(riyadhDate(new Date('2026-11-03T20:59:00Z'))).toBe('2026-11-03');
    expect(daySpan('2026-11-01', '2026-11-01')).toBe(1);
    expect(daySpan('2026-01-01', '2026-12-31')).toBe(365);
    expect(validRange('2026-11-01', '2026-11-30')).toBe(true);
    expect(validRange('2026-11-30', '2026-11-01')).toBe(false);
    expect(validRange('2025-01-01', '2026-01-01')).toBe(true);
    expect(daySpan('2025-01-01', '2026-01-02')).toBe(REPORT_MAX_DAYS + 1);
    expect(validRange('2025-01-01', '2026-01-02')).toBe(false);
    expect(validRange('2026-13-01', '2026-13-02')).toBe(false);
    expect(validRange('', '2026-11-01')).toBe(false);
  });

  it('review 04 W-4: review reasons, refund states and sources have labels; the new codes have messages', () => {
    expect(reviewReason('external_refund')).toContain('استرداد');
    expect(reviewReason('voided_after_capture')).toContain('ألغت');
    expect(reviewReason('amount_mismatch')).not.toBe('amount_mismatch');
    expect(refundStatus('requested').tone).toBe('warning');
    expect(refundSource('gateway')).toContain('بوابة');
    expect(refundSource('store')).toContain('المتجر');
    expect(problemMessage({ status: 409, code: 'payment.review_partial', extra: { captured: '31.00', total: '32.00' } })).toContain('31');
    expect(problemMessage({ status: 422, code: 'checkout.below_minimum', extra: { minimum: '1.00' } })).toContain('1');
    const fallback = problemMessage({ status: 409, code: 'nope' });
    for (const code of ['payment.refund_pending', 'payment.orphan_not_found', 'payment.orphan_resolved'])
      expect(problemMessage({ status: 409, code }), code).not.toBe(fallback);
  });

  it('review 04 W-3: an orphan resolution note is 1–500 characters', () => {
    expect(validNote('  ')).toBe(false);
    expect(validNote('refunded on the dashboard')).toBe(true);
    expect(validNote('x'.repeat(501))).toBe(false);
  });
});

