import type { CartLine } from '../../../core/api/api.types';
import { lineProblem } from './line-problems';

const limits = {
  minGiftAmount: '10.00',
  maxLineAmount: '100000.00',
  cartMaxLines: 50,
  cartMaxTotal: '100000.00',
};
const line = (targetKind: 'project' | 'category') => ({ targetKind }) as CartLine;

describe('cart problems (W-5: values from the config)', () => {
  it('names the limit from the config and the fix', () => {
    const below = lineProblem('cart.amount_below_minimum', line('category'), limits);
    expect(below.text).toContain('10');
    expect(below.fix).toBe('amount');
    expect(lineProblem('cart.too_many_lines', null, limits).text).toContain('50');
    expect(lineProblem('cart.total_exceeded', null, limits).text).toContain('100,000');
    expect(lineProblem('cart.amount_above_maximum', line('project'), limits).text).toContain(
      '100,000',
    );
  });

  it('unavailable targets and options are fixed by removing the line', () => {
    for (const code of [
      'cart.target_unavailable',
      'cart.option_unavailable',
      'cart.open_amount_not_allowed',
    ])
      expect(lineProblem(code, line('project'), limits).fix).toBe('remove');
  });

  it('a project line has no exact minimum on the cart: generic text, still an amount fix', () => {
    const p = lineProblem('cart.amount_below_minimum', line('project'), limits);
    expect(p.text).not.toContain('10');
    expect(p.fix).toBe('amount');
  });
});
