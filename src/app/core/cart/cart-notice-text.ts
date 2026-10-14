import type { CartNotice } from '../api/api.types';
import { problemMessage } from '../api/problem-message';

/** Cart notices (RUL-17 merge, server cart notices) → the visitor's text. Cart and checkout show them. */
export function cartNoticeText(n: CartNotice): string {
  switch (n.code) {
    case 'cart.merge_dropped_owned_course':
      return $localize`:@@store.cart.notice-owned:أزلنا من سلتك دورة أنت مسجّل فيها مسبقًا.`;
    case 'cart.merge_combined':
      return $localize`:@@store.cart.notice-combined:دمجنا عناصر متطابقة من سلتك السابقة.`;
    default:
      return problemMessage({ code: n.code, status: 422 });
  }
}
