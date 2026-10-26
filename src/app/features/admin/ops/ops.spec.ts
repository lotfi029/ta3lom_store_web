import type { AdminOrderLine } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { lineTitle } from './order.page';
import { orderParams, upperRef } from './ops.data';
import { rangeOk } from './orders.page';

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
});
