import { checkAmount, displayAmount } from './amount';

describe('checkAmount (contract 15 §1.3)', () => {
  it('normalises Arabic-Indic and Eastern Arabic digits and the Arabic decimal separator', () => {
    expect(checkAmount('١٠٠', '10.00', '100000.00')).toEqual({ ok: true, amount: '100.00' });
    expect(checkAmount('۵۰٫۵', null, null)).toEqual({ ok: true, amount: '50.50' });
    expect(checkAmount(' 75 ', null, null)).toEqual({ ok: true, amount: '75.00' });
    expect(displayAmount('١٢٣٫٤')).toBe('123.4');
  });

  it('refuses group separators, signs, exponents, too many decimals and zero', () => {
    for (const bad of ['1,000', '-5', '+5', '1e3', '10.555', 'abc', '١٬٠٠٠'])
      expect(checkAmount(bad, null, null)).toEqual({ ok: false, reason: 'format' });
    expect(checkAmount('0', null, null)).toEqual({ ok: false, reason: 'zero' });
    expect(checkAmount('', null, null)).toEqual({ ok: false, reason: 'empty' });
  });

  it('checks the minimum and the maximum it is given (config / project), with the limit', () => {
    expect(checkAmount('5', '10.00', '100000.00')).toEqual({
      ok: false,
      reason: 'min',
      limit: '10.00',
    });
    expect(checkAmount('25', '50', null)).toEqual({ ok: false, reason: 'min', limit: '50.00' });
    expect(checkAmount('100000.01', '10.00', '100000.00')).toEqual({
      ok: false,
      reason: 'max',
      limit: '100000.00',
    });
    expect(checkAmount('100000', '10.00', '100000.00')).toEqual({ ok: true, amount: '100000.00' });
  });
});
