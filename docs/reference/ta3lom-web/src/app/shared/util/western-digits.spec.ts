import { describe, expect, it } from 'vitest';
import { westernDigits } from './western-digits';

describe('westernDigits', () => {
  it('converts Arabic-Indic and Persian digits and the Arabic separators', () => {
    expect(westernDigits('١٬٢٤٠')).toBe('1,240');
    expect(westernDigits('٨١٪')).toBe('81٪');
    expect(westernDigits('۴۳K')).toBe('43K');
    expect(westernDigits('٣٫٥')).toBe('3.5');
  });

  it('leaves Western digits and text alone', () => {
    expect(westernDigits('43K+')).toBe('43K+');
  });
});
