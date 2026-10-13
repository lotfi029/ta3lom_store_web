import { add, compare, fromHalalas, isZero, normalize, subtract, sum, times, toHalalas } from './money';
import { formatAmount, formatMoney } from './money-format';

describe('money (halalas, never floats)', () => {
  it('multiplies a price by a quantity exactly', () => {
    expect(times('350.00', 5)).toBe('1750.00');
    expect(times('19.99', 3)).toBe('59.97');
  });

  it('adds without floating-point drift', () => {
    expect(sum(['0.10', '0.20'])).toBe('0.30');
    expect(add('0.10', '0.20')).toBe('0.30');
    expect(sum([])).toBe('0.00');
    expect(subtract('100.00', '25.50')).toBe('74.50');
  });

  it('round-trips halalas', () => {
    expect(toHalalas('350.00')).toBe(35000);
    expect(toHalalas('0.05')).toBe(5);
    expect(toHalalas('12.5')).toBe(1250);
    expect(fromHalalas(5)).toBe('0.05');
    expect(fromHalalas(-1250)).toBe('-12.50');
    expect(normalize('350')).toBe('350.00');
  });

  it('rejects anything that is not a plain decimal', () => {
    for (const bad of ['1e3', '1,000.00', '12.345', 'abc', '']) expect(() => toHalalas(bad)).toThrow();
    expect(() => times('10.00', 1.5)).toThrow();
  });

  it('compares and detects zero', () => {
    expect(compare('10.00', '9.99')).toBe(1);
    expect(compare('9.99', '10.00')).toBe(-1);
    expect(compare('10', '10.00')).toBe(0);
    expect(isZero('0.00')).toBe(true);
    expect(isZero(null)).toBe(true);
    expect(isZero('0.01')).toBe(false);
  });
});

describe('money display', () => {
  it('uses Western digits in Arabic and drops .00 on whole riyals', () => {
    expect(formatAmount('1750.00', 'ar')).toBe('1,750');
    expect(formatAmount('59.97', 'ar')).toBe('59.97');
    expect(formatAmount('1750.00', 'en')).toBe('1,750');
    expect(formatMoney('25.00', 'ar')).toBe('25 ر.س');
    expect(formatMoney('25.50', 'en')).toBe('SAR 25.50');
    expect(formatAmount('1750.00', 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('formats a decimal string exactly (no binary rounding)', () => {
    expect(formatAmount('1234567.89', 'en')).toBe('1,234,567.89');
  });
});
