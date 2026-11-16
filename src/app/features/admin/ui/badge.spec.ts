import {
  CUSTOMER_STATUSES,
  ORDER_STATUSES,
  PROJECT_BADGES,
  PROJECT_STATUSES,
  badgeKind,
} from './badge';

describe('admin badge kinds (W-A0, spec §5)', () => {
  it('maps every project status', () => {
    expect(PROJECT_STATUSES.map(badgeKind)).toEqual(['draft', 'ok', 'err']);
  });

  it('maps every donation status', () => {
    expect(ORDER_STATUSES.map(badgeKind)).toEqual(['sched', 'ok', 'warn', 'draft', 'err', 'draft']);
  });

  it('maps every donor status and project badge', () => {
    expect(CUSTOMER_STATUSES.map(badgeKind)).toEqual(['ok', 'err', 'draft']);
    expect(PROJECT_BADGES.map(badgeKind)).toEqual(['new', 'warn']);
  });

  it('keeps unknown or missing values neutral', () => {
    expect(badgeKind('something_new')).toBe('draft');
    expect(badgeKind(null)).toBe('draft');
    expect(badgeKind(undefined)).toBe('draft');
  });
});
