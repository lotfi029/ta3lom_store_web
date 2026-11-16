import { paletteTarget } from './palette-target';

describe('command palette routing (W-A1, review S1)', () => {
  it('opens a donation for a full reference, in any case and with Arabic-Indic digits', () => {
    expect(paletteTarget('T3-26-000001')).toEqual({ kind: 'order', reference: 'T3-26-000001' });
    expect(paletteTarget(' t3-26-000123 ')).toEqual({ kind: 'order', reference: 'T3-26-000123' });
    expect(paletteTarget('T3-٢٦-٠٠٠٠٠١')).toEqual({ kind: 'order', reference: 'T3-26-000001' });
  });

  it('searches donations by a partial reference', () => {
    expect(paletteTarget('t3-26')).toEqual({ kind: 'reference', reference: 'T3-26' });
  });

  it('searches donations by a Saudi mobile in any typed form', () => {
    for (const m of ['0551234567', '551234567', '+966551234567', '00966 55 123 4567', '٠٥٥١٢٣٤٥٦٧'])
      expect(paletteTarget(m)).toEqual({ kind: 'mobile', mobile: '0551234567' });
  });

  it('treats anything else as text (screens and projects)', () => {
    expect(paletteTarget('كفالة')).toEqual({ kind: 'text', q: 'كفالة' });
    expect(paletteTarget('0412345678')).toEqual({ kind: 'text', q: '0412345678' });
    expect(paletteTarget('T3')).toEqual({ kind: 'text', q: 'T3' });
    expect(paletteTarget('   ')).toEqual({ kind: 'empty' });
  });
});
