/**
 * ProblemDetails `code` → the visitor's message (11 §1.6, r4 codes only — giving and refund codes are out of scope).
 * Arabic is the source; English lives in src/locales/en.json. Unknown codes fall back by HTTP class.
 * Built from 11 §1.6 (ids are `@@store.error.<code with dashes>`).
 */
import type { StoreProblem } from './problem';

export function problemMessage(problem: Pick<StoreProblem, 'code' | 'status'>): string {
  switch (problem.code) {
    case 'validation.failed':
      return $localize`:@@store.error.validation-failed:تحقّق من الحقول المميّزة ثم أعد المحاولة.`;
    case 'http.not_found':
      return $localize`:@@store.error.http-not-found:لم نجد ما تبحث عنه.`;
    case 'http.rate_limited':
      return $localize`:@@store.error.http-rate-limited:طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.`;
    case 'http.origin_forbidden':
      return $localize`:@@store.error.http-origin-forbidden:تعذّر إتمام الطلب من هذه الصفحة. حدّث الصفحة ثم أعد المحاولة.`;
    case 'http.error':
      return $localize`:@@store.error.http-error:تعذّر إتمام الطلب.`;
    case 'server.error':
      return $localize`:@@store.error.server-error:حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.`;
    case 'network.error':
      return $localize`:@@store.error.network-error:تعذّر الاتصال بالمتجر. تحقّق من اتصالك ثم أعد المحاولة.`;
    case 'auth.unauthenticated':
      return $localize`:@@store.error.auth-unauthenticated:انتهت جلستك. سجّل الدخول مرة أخرى.`;
    case 'auth.forbidden':
      return $localize`:@@store.error.auth-forbidden:صلاحياتك لا تسمح بهذا الإجراء.`;
    case 'auth.account_blocked':
      return $localize`:@@store.error.auth-account-blocked:هذا الحساب موقوف. تواصل مع الجمعية للمساعدة.`;
    case 'auth.refresh_invalid':
      return $localize`:@@store.error.auth-refresh-invalid:انتهت جلستك. سجّل الدخول مرة أخرى.`;
    case 'auth.refresh_expired':
      return $localize`:@@store.error.auth-refresh-expired:انتهت جلستك. سجّل الدخول مرة أخرى.`;
    case 'auth.refresh_reused':
      return $localize`:@@store.error.auth-refresh-reused:أُنهيت جلساتك لحمايتك. سجّل الدخول مرة أخرى.`;
    case 'auth.refresh_race':
      return $localize`:@@store.error.auth-refresh-race:حدث تعارض في الجلسة. أعد المحاولة.`;
    case 'auth.invalid_credentials':
      return $localize`:@@store.error.auth-invalid-credentials:البريد الإلكتروني أو كلمة المرور غير صحيحة.`;
    case 'auth.account_locked':
      return $localize`:@@store.error.auth-account-locked:الحساب مقفل مؤقتًا بعد محاولات كثيرة. حاول لاحقًا.`;
    case 'auth.totp_required':
      return $localize`:@@store.error.auth-totp-required:أدخل رمز التحقق من تطبيق المصادقة.`;
    case 'auth.totp_invalid':
      return $localize`:@@store.error.auth-totp-invalid:رمز التحقق غير صحيح.`;
    case 'auth.totp_not_enrolled':
      return $localize`:@@store.error.auth-totp-not-enrolled:فعّل التحقق بخطوتين أولًا.`;
    case 'otp.mobile_invalid':
      return $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`;
    case 'otp.rate_limited':
      return $localize`:@@store.error.otp-rate-limited:طلبت رموزًا كثيرة. انتظر قليلًا ثم أعد المحاولة.`;
    case 'otp.invalid':
      return $localize`:@@store.error.otp-invalid:الرمز غير صحيح.`;
    case 'otp.expired':
      return $localize`:@@store.error.otp-expired:انتهت صلاحية الرمز. اطلب رمزًا جديدًا.`;
    case 'otp.too_many_attempts':
      return $localize`:@@store.error.otp-too-many-attempts:محاولات خاطئة كثيرة. اطلب رمزًا جديدًا.`;
    case 'concurrency.conflict':
      return $localize`:@@store.error.concurrency-conflict:تغيّرت البيانات أثناء التعديل. حدّث الصفحة ثم أعد المحاولة.`;
    case 'idempotency.key_required':
      return $localize`:@@store.error.idempotency-key-required:تعذّر إرسال الطلب. أعد المحاولة.`;
    case 'idempotency.key_reused':
      return $localize`:@@store.error.idempotency-key-reused:تعذّر إرسال الطلب. أعد المحاولة.`;
    case 'idempotency.in_progress':
      return $localize`:@@store.error.idempotency-in-progress:طلبك قيد المعالجة. انتظر لحظة.`;
    case 'catalog.product_not_found':
      return $localize`:@@store.error.catalog-product-not-found:هذا المنتج غير متاح.`;
    case 'cart.product_unavailable':
      return $localize`:@@store.error.cart-product-unavailable:هذا المنتج لم يعد متاحًا.`;
    case 'cart.mode_not_allowed':
      return $localize`:@@store.error.cart-mode-not-allowed:لا يمكن إضافة هذا المنتج بهذه الطريقة.`;
    case 'cart.quantity_limit':
      return $localize`:@@store.error.cart-quantity-limit:الكمية أكبر من الحد المسموح.`;
    case 'cart.duplicate_course':
      return $localize`:@@store.error.cart-duplicate-course:هذه الدورة موجودة في سلتك.`;
    case 'cart.course_owned':
      return $localize`:@@store.error.cart-course-owned:أنت مسجّل في هذه الدورة مسبقًا.`;
    case 'cart.course_in_unpaid_order':
      return $localize`:@@store.error.cart-course-in-unpaid-order:هذه الدورة في طلب لم يُدفع بعد.`;
    case 'cart.out_of_stock':
      return $localize`:@@store.error.cart-out-of-stock:الكمية المطلوبة غير متوفرة.`;
    case 'cart.too_many_lines':
      return $localize`:@@store.error.cart-too-many-lines:وصلت سلتك إلى الحد الأقصى من العناصر.`;
    case 'cart.total_exceeded':
      return $localize`:@@store.error.cart-total-exceeded:تجاوز مجموع السلة الحد المسموح.`;
    case 'cart.line_not_found':
      return $localize`:@@store.error.cart-line-not-found:هذا العنصر لم يعد في سلتك.`;
    case 'checkout.cart_empty':
      return $localize`:@@store.error.checkout-cart-empty:سلتك فارغة.`;
    case 'checkout.lines_invalid':
      return $localize`:@@store.error.checkout-lines-invalid:بعض عناصر السلة لم تعد متاحة. راجعها ثم أعد المحاولة.`;
    case 'checkout.price_changed':
      return $localize`:@@store.error.checkout-price-changed:تغيّرت الأسعار منذ آخر مراجعة. راجع الملخص المحدّث.`;
    case 'checkout.out_of_stock':
      return $localize`:@@store.error.checkout-out-of-stock:نفدت كمية أحد الكتب أثناء الطلب.`;
    case 'checkout.address_required':
      return $localize`:@@store.error.checkout-address-required:أدخل عنوان الشحن للكتب المطبوعة.`;
    case 'checkout.contact_required':
      return $localize`:@@store.error.checkout-contact-required:أدخل الاسم والبريد الإلكتروني.`;
    case 'checkout.terms_not_accepted':
      return $localize`:@@store.error.checkout-terms-not-accepted:يلزم الموافقة على الشروط والأحكام.`;
    case 'checkout.payment_method_not_allowed':
      return $localize`:@@store.error.checkout-payment-method-not-allowed:طريقة الدفع هذه غير متاحة.`;
    case 'checkout.gateway_unavailable':
      return $localize`:@@store.error.checkout-gateway-unavailable:تعذّر بدء الدفع الآن. طلبك محفوظ؛ أعد المحاولة لاحقًا.`;
    case 'order.not_found':
      return $localize`:@@store.error.order-not-found:لم نجد هذا الطلب.`;
    case 'order.retry_not_allowed':
      return $localize`:@@store.error.order-retry-not-allowed:لا يمكن إعادة الدفع لهذا الطلب.`;
    case 'order.payment_window_closed':
      return $localize`:@@store.error.order-payment-window-closed:انتهت مهلة الدفع لهذا الطلب.`;
    case 'order.cancel_not_allowed':
      return $localize`:@@store.error.order-cancel-not-allowed:لا يمكن إلغاء هذا الطلب في حالته الحالية.`;
    case 'download.limit_reached':
      return $localize`:@@store.error.download-limit-reached:استنفدت عدد مرات التنزيل المتاحة.`;
    case 'download.revoked':
      return $localize`:@@store.error.download-revoked:أُلغي حق التنزيل لهذا الكتاب.`;
    case 'download.link_expired':
      return $localize`:@@store.error.download-link-expired:انتهت صلاحية رابط التنزيل. اطلب رابطًا جديدًا.`;
    case 'enrolment.not_active':
      return $localize`:@@store.error.enrolment-not-active:التسجيل في هذه الدورة غير نشط.`;
    case 'document.not_found':
      return $localize`:@@store.error.document-not-found:المستند غير متوفر.`;
    case 'document.not_ready':
      return $localize`:@@store.error.document-not-ready:المستند قيد الإعداد. حاول بعد قليل.`;
    case 'product.slug_taken':
      return $localize`:@@store.error.product-slug-taken:هذا الرابط مستخدم لمنتج آخر.`;
    case 'category.slug_taken':
      return $localize`:@@store.error.category-slug-taken:هذا الرابط مستخدم لتصنيف آخر.`;
    case 'product.type_locked':
      return $localize`:@@store.error.product-type-locked:لا يمكن تغيير نوع المنتج بعد أول طلب.`;
    case 'product.publish_incomplete':
      return $localize`:@@store.error.product-publish-incomplete:لا يمكن النشر قبل استكمال البيانات المطلوبة.`;
    case 'media.alt_required':
      return $localize`:@@store.error.media-alt-required:أضف نصًا بديلًا بالعربية للصورة.`;
    case 'media.type_not_allowed':
      return $localize`:@@store.error.media-type-not-allowed:نوع الملف غير مسموح.`;
    case 'media.too_large':
      return $localize`:@@store.error.media-too-large:حجم الملف أكبر من المسموح.`;
    case 'stock.below_reserved':
      return $localize`:@@store.error.stock-below-reserved:لا يمكن أن يقل المخزون عن الكمية المحجوزة.`;
    case 'shipment.invalid_transition':
      return $localize`:@@store.error.shipment-invalid-transition:لا يمكن نقل الشحنة إلى هذه الحالة الآن.`;
    case 'setting.unknown_key':
      return $localize`:@@store.error.setting-unknown-key:هذا الإعداد غير معروف.`;
    case 'setting.invalid_value':
      return $localize`:@@store.error.setting-invalid-value:القيمة غير صالحة لهذا الإعداد.`;
    case 'template.render_failed':
      return $localize`:@@store.error.template-render-failed:في القالب خطأ في الصياغة.`;
    case 'staff.email_taken':
      return $localize`:@@store.error.staff-email-taken:هذا البريد مستخدم لموظف آخر.`;
    default:
      if (problem.status >= 500 || problem.status === 0)
        return $localize`:@@store.error.fallback-server:حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.`;
      return $localize`:@@store.error.fallback:تعذّر إتمام الطلب.`;
  }
}

/** Every r4 code with a message — the unit test checks each one maps to a non-empty, code-specific text. */
export const R4_ERROR_CODES: readonly string[] = [
  'validation.failed',
  'http.not_found',
  'http.rate_limited',
  'http.origin_forbidden',
  'http.error',
  'server.error',
  'network.error',
  'auth.unauthenticated',
  'auth.forbidden',
  'auth.account_blocked',
  'auth.refresh_invalid',
  'auth.refresh_expired',
  'auth.refresh_reused',
  'auth.refresh_race',
  'auth.invalid_credentials',
  'auth.account_locked',
  'auth.totp_required',
  'auth.totp_invalid',
  'auth.totp_not_enrolled',
  'otp.mobile_invalid',
  'otp.rate_limited',
  'otp.invalid',
  'otp.expired',
  'otp.too_many_attempts',
  'concurrency.conflict',
  'idempotency.key_required',
  'idempotency.key_reused',
  'idempotency.in_progress',
  'catalog.product_not_found',
  'cart.product_unavailable',
  'cart.mode_not_allowed',
  'cart.quantity_limit',
  'cart.duplicate_course',
  'cart.course_owned',
  'cart.course_in_unpaid_order',
  'cart.out_of_stock',
  'cart.too_many_lines',
  'cart.total_exceeded',
  'cart.line_not_found',
  'checkout.cart_empty',
  'checkout.lines_invalid',
  'checkout.price_changed',
  'checkout.out_of_stock',
  'checkout.address_required',
  'checkout.contact_required',
  'checkout.terms_not_accepted',
  'checkout.payment_method_not_allowed',
  'checkout.gateway_unavailable',
  'order.not_found',
  'order.retry_not_allowed',
  'order.payment_window_closed',
  'order.cancel_not_allowed',
  'download.limit_reached',
  'download.revoked',
  'download.link_expired',
  'enrolment.not_active',
  'document.not_found',
  'document.not_ready',
  'product.slug_taken',
  'category.slug_taken',
  'product.type_locked',
  'product.publish_incomplete',
  'media.alt_required',
  'media.type_not_allowed',
  'media.too_large',
  'stock.below_reserved',
  'shipment.invalid_transition',
  'setting.unknown_key',
  'setting.invalid_value',
  'template.render_failed',
  'staff.email_taken',
];
