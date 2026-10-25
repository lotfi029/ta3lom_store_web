import type { CartNotice } from '../api/api.types';

/** Guest-cart merge notices from the sign-in (`SessionResponse.cartNotices`) → the donor's text. */
export function cartNoticeText(n: CartNotice): string {
  switch (n.code) {
    case 'cart.merge_dropped':
      return $localize`:@@store.cart.notice-dropped:أزلنا من سلتك تبرعًا لم يعد متاحًا أو تجاوز حدود السلة.`;
    case 'cart.merge_combined':
    default:
      return $localize`:@@store.cart.notice-combined:دمجنا تبرعات سلتك السابقة مع سلتك الحالية.`;
  }
}
