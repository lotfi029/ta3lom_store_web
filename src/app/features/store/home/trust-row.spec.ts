import { trustItems } from './trust-row';

describe('trust row (Option C §3 row 8, owner M-3)', () => {
  it('flags off (default): licensed + receipt only', () => {
    expect(trustItems({ showZakat: false, showUpdates: false }).map((i) => i.key)).toEqual([
      'licensed',
      'receipt',
    ]);
  });

  it('each flag adds its item, in the mockup order', () => {
    expect(trustItems({ showZakat: true, showUpdates: false }).map((i) => i.key)).toEqual([
      'licensed',
      'receipt',
      'zakat',
    ]);
    expect(trustItems({ showZakat: true, showUpdates: true }).map((i) => i.key)).toEqual([
      'licensed',
      'receipt',
      'zakat',
      'updates',
    ]);
  });
});
