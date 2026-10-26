import type { CartLine } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';

export interface Limits {
  minGiftAmount: string | null;
  maxLineAmount: string | null;
  cartMaxLines: number | null;
  cartMaxTotal: string | null;
}

/** What the donor can do about a line problem: remove the line, or change its amount. */
export type LineFix = 'remove' | 'amount';

/**
 * A cart problem code (per line or cart-level, contract 15 §1.9) → its text with the limit values from
 * `/catalog/config` (W-5) and the action that fixes it. A project's own `minAmount` is not on the cart line, so a
 * project line's minimum text is generic; the API's 422 on the edit then names the exact minimum.
 */
export function lineProblem(
  code: string,
  line: CartLine | null,
  limits: Limits,
): { text: string; fix: LineFix | null } {
  const extra: Record<string, unknown> = {};
  let fix: LineFix | null = null;
  switch (code) {
    case 'cart.amount_below_minimum':
      if (line?.targetKind === 'category' && limits.minGiftAmount)
        extra['min'] = limits.minGiftAmount;
      fix = 'amount';
      break;
    case 'cart.amount_above_maximum':
      if (limits.maxLineAmount) extra['max'] = limits.maxLineAmount;
      fix = 'amount';
      break;
    case 'cart.too_many_lines':
      if (limits.cartMaxLines !== null) extra['max'] = limits.cartMaxLines;
      fix = 'remove';
      break;
    case 'cart.total_exceeded':
      if (limits.cartMaxTotal) extra['max'] = limits.cartMaxTotal;
      fix = line ? 'amount' : 'remove';
      break;
    case 'cart.target_unavailable':
    case 'cart.option_unavailable':
    case 'cart.open_amount_not_allowed':
      fix = 'remove';
      break;
  }
  return { text: problemMessage({ code, status: 422, extra }), fix };
}
