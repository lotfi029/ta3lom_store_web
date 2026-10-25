/**
 * ProblemDetails `code` → the visitor's message (contract 15 §4, R5 codes). Arabic is the source; English lives in
 * src/locales/en.json. Unknown codes fall back by HTTP class. Ids are `@@store.error.<code with dashes>`.
 * Extension members that carry a value the visitor needs (`min`, `max`, `attemptsLeft`, `retryAfterSeconds`,
 * `lockedUntil`, `label`, `line`/`column`) are put into the text; money values are formatted with Western digits.
 * The API's validation texts (`errors{}`) are English only (API-6), so field errors are mapped by FIELD here
 * (`fieldMessage`), never shown raw.
 */
import { formatMoney } from '../money/money-format';
import type { StoreProblem } from './problem';

type ProblemLike = Pick<StoreProblem, 'code' | 'status'> &
  Partial<Pick<StoreProblem, 'extra' | 'retryAfterSeconds'>>;

const isEnglish = (): boolean => {
  const l = (globalThis as { $localize?: { locale?: string } }).$localize?.locale;
  return !!l && l.startsWith('en');
};

/** A money extension (`"50.00"`) as display text; any other value as-is. */
function money(v: unknown): string {
  if (typeof v !== 'string' || !/^\d+(\.\d{1,2})?$/.test(v))
    return v === undefined ? '' : String(v);
  return formatMoney(v, isEnglish() ? 'en' : 'ar');
}

/** `media.too_large.max` is bytes (or pixels for the 40 MP limit): bytes → whole MB. */
function megabytes(v: unknown): string {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 1024 * 1024 ? String(Math.round(n / (1024 * 1024))) : '';
}

export function problemMessage(problem: ProblemLike): string {
  const x = problem.extra ?? {};
  switch (problem.code) {
    case 'validation.failed':
      return $localize`:@@store.error.validation-failed:تحقّق من الحقول المميّزة ثم أعد المحاولة.`;
    case 'http.not_found':
      return $localize`:@@store.error.http-not-found:لم نجد ما تبحث عنه.`;
    case 'http.rate_limited': {
      const s = problem.retryAfterSeconds;
      return s
        ? $localize`:@@store.error.http-rate-limited-wait:طلبات كثيرة في وقت قصير. أعد المحاولة بعد ${s}:seconds: ثانية.`
        : $localize`:@@store.error.http-rate-limited:طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.`;
    }
    case 'http.origin_forbidden':
      return $localize`:@@store.error.http-origin-forbidden:تعذّر إتمام الطلب من هذه الصفحة. حدّث الصفحة ثم أعد المحاولة.`;
    case 'http.error':
      return problem.status === 413
        ? $localize`:@@store.error.http-too-large:الملف أكبر من الحجم المسموح.`
        : $localize`:@@store.error.http-error:تعذّر إتمام الطلب.`;
    case 'server.error':
      return $localize`:@@store.error.server-error:حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.`;
    case 'network.error':
      return $localize`:@@store.error.network-error:تعذّر الاتصال بالمتجر. تحقّق من اتصالك ثم أعد المحاولة.`;
    case 'concurrency.conflict':
      return $localize`:@@store.error.concurrency-conflict:عدّل شخص آخر هذه البيانات أثناء عملك. حدّثها ثم أعد التعديل.`;
    case 'db.duplicate':
      return $localize`:@@store.error.db-duplicate:هذه القيمة مستخدمة مسبقًا.`;
    case 'db.reference_missing':
      return $localize`:@@store.error.db-reference-missing:أحد العناصر المرتبطة لم يعد موجودًا. حدّث الصفحة.`;

    case 'auth.unauthenticated':
      return $localize`:@@store.error.auth-unauthenticated:انتهت جلستك. سجّل الدخول مرة أخرى.`;
    case 'auth.forbidden':
      return $localize`:@@store.error.auth-forbidden:صلاحياتك لا تسمح بهذا الإجراء.`;
    case 'auth.account_blocked':
      return $localize`:@@store.error.auth-account-blocked:هذا الحساب موقوف. تواصل مع الجمعية للمساعدة.`;
    case 'auth.refresh_invalid':
    case 'auth.refresh_expired':
      return $localize`:@@store.error.auth-refresh-expired:انتهت جلستك. سجّل الدخول مرة أخرى.`;
    case 'auth.refresh_reused':
      return $localize`:@@store.error.auth-refresh-reused:أُنهيت جلساتك لحمايتك. سجّل الدخول مرة أخرى.`;
    case 'auth.refresh_race':
      return $localize`:@@store.error.auth-refresh-race:حدث تعارض في الجلسة. أعد المحاولة.`;
    case 'auth.invalid_credentials':
      return $localize`:@@store.error.auth-invalid-credentials:البريد الإلكتروني أو كلمة المرور غير صحيحة.`;
    case 'auth.account_locked':
      return $localize`:@@store.error.auth-account-locked:الحساب مقفل مؤقتًا بعد محاولات كثيرة. حاول بعد ساعة.`;
    case 'auth.totp_required':
      return $localize`:@@store.error.auth-totp-required:انتهت خطوة التحقق. سجّل الدخول من جديد.`;
    case 'auth.totp_invalid':
      return $localize`:@@store.error.auth-totp-invalid:رمز التحقق غير صحيح.`;
    case 'auth.totp_not_enrolled':
      return $localize`:@@store.error.auth-totp-not-set-up:فعّل التحقق بخطوتين أولًا.`;
    case 'auth.totp_already_enrolled':
      return $localize`:@@store.error.auth-totp-already-set-up:التحقق بخطوتين مفعّل مسبقًا لهذا الحساب.`;
    case 'auth.totp_unavailable':
      return $localize`:@@store.error.auth-totp-unavailable:تعذّر التحقق الآن. اطلب من مدير النظام إعادة ضبط التحقق بخطوتين.`;
    case 'auth.password_change_required':
      return $localize`:@@store.error.auth-password-change-required:غيّر كلمة المرور أولًا للمتابعة.`;
    case 'auth.password_weak':
      return $localize`:@@store.error.auth-password-weak:كلمة المرور الجديدة ضعيفة.`;
    case 'auth.current_password_invalid':
      return $localize`:@@store.error.auth-current-password-invalid:كلمة المرور الحالية غير صحيحة.`;

    case 'otp.mobile_invalid':
      return $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`;
    case 'otp.rate_limited': {
      const s = problem.retryAfterSeconds;
      return s
        ? $localize`:@@store.error.otp-rate-limited-wait:طلبت رموزًا كثيرة. أعد المحاولة بعد ${Math.ceil(s / 60)}:minutes: دقيقة.`
        : $localize`:@@store.error.otp-rate-limited:طلبت رموزًا كثيرة. انتظر قليلًا ثم أعد المحاولة.`;
    }
    case 'otp.invalid': {
      const left = x['attemptsLeft'];
      return typeof left === 'number'
        ? $localize`:@@store.error.otp-invalid-left:الرمز غير صحيح. تبقّى ${left}:attempts: محاولات.`
        : $localize`:@@store.error.otp-invalid:الرمز غير صحيح.`;
    }
    case 'otp.expired':
      return $localize`:@@store.error.otp-expired:انتهت صلاحية الرمز. اطلب رمزًا جديدًا.`;
    case 'otp.too_many_attempts':
      return $localize`:@@store.error.otp-too-many-attempts:محاولات خاطئة كثيرة. اطلب رمزًا جديدًا.`;

    case 'idempotency.key_required':
    case 'idempotency.key_reused':
      return $localize`:@@store.error.idempotency-key-reused:تعذّر إرسال الطلب. أعد المحاولة.`;
    case 'idempotency.in_progress':
      return $localize`:@@store.error.idempotency-in-progress:تبرعك قيد التسجيل. انتظر لحظة.`;

    case 'cart.target_unavailable':
      return $localize`:@@store.error.cart-target-unavailable:هذا المشروع أو التصنيف لم يعد يستقبل التبرعات.`;
    case 'cart.option_unavailable':
      return $localize`:@@store.error.cart-option-unavailable:هذا الخيار لم يعد متاحًا.`;
    case 'cart.open_amount_not_allowed':
      return $localize`:@@store.error.cart-open-amount-not-allowed:هذا المشروع لا يقبل مبلغًا مفتوحًا. اختر أحد الخيارات.`;
    case 'cart.amount_below_minimum': {
      const min = money(x['min']);
      return min
        ? $localize`:@@store.error.cart-amount-below-minimum-value:أقل مبلغ للتبرع ${min}:min:.`
        : $localize`:@@store.error.cart-amount-below-minimum:المبلغ أقل من الحد الأدنى للتبرع.`;
    }
    case 'cart.amount_above_maximum': {
      const max = money(x['max']);
      return max
        ? $localize`:@@store.error.cart-amount-above-maximum-value:أعلى مبلغ للتبرع الواحد ${max}:max:.`
        : $localize`:@@store.error.cart-amount-above-maximum:المبلغ أعلى من الحد المسموح.`;
    }
    case 'cart.quantity_limit': {
      const max = x['max'];
      return max !== undefined
        ? $localize`:@@store.error.cart-quantity-limit-value:الكمية القصوى ${String(max)}:max:.`
        : $localize`:@@store.error.cart-quantity-limit:الكمية أكبر من الحد المسموح.`;
    }
    case 'cart.too_many_lines': {
      const max = x['max'];
      return max !== undefined
        ? $localize`:@@store.error.cart-too-many-lines-value:تتسع السلة لـ ${String(max)}:max: تبرعًا كحد أقصى.`
        : $localize`:@@store.error.cart-too-many-lines:وصلت سلتك إلى الحد الأقصى من التبرعات.`;
    }
    case 'cart.total_exceeded': {
      const max = money(x['max']);
      return max
        ? $localize`:@@store.error.cart-total-exceeded-value:مجموع السلة لا يتجاوز ${max}:max:.`
        : $localize`:@@store.error.cart-total-exceeded:تجاوز مجموع السلة الحد المسموح.`;
    }
    case 'cart.line_not_found':
      return $localize`:@@store.error.cart-line-not-found:هذا التبرع لم يعد في سلتك.`;

    case 'checkout.cart_empty':
      return $localize`:@@store.error.checkout-cart-empty:سلتك فارغة.`;
    case 'checkout.lines_invalid':
      return $localize`:@@store.error.checkout-lines-invalid:بعض تبرعات السلة تحتاج مراجعة. صحّحها ثم أعد المحاولة.`;
    case 'checkout.contact_required':
      return $localize`:@@store.error.checkout-contact-required:أدخل الاسم والبريد الإلكتروني.`;

    case 'order.not_found':
      return $localize`:@@store.error.order-not-found:لم نجد هذا التبرع.`;
    case 'order.cancel_not_allowed':
      return $localize`:@@store.error.order-cancel-not-allowed:لا يمكن إلغاء هذا الطلب في حالته الحالية.`;

    case 'staff.email_taken':
      return $localize`:@@store.error.staff-email-taken:هذا البريد مستخدم لموظف آخر.`;
    case 'staff.last_admin':
      return $localize`:@@store.error.staff-last-admin:لا يمكن إزالة آخر مدير نظام نشط.`;
    case 'media.alt_required':
      return $localize`:@@store.error.media-alt-required:أضف نصًا بديلًا بالعربية للصورة.`;
    case 'media.type_not_allowed':
      return $localize`:@@store.error.media-type-not-allowed:نوع الملف غير مسموح. ارفع صورة JPEG أو PNG أو WebP.`;
    case 'media.too_large': {
      const mb = megabytes(x['max']);
      return mb
        ? $localize`:@@store.error.media-too-large-value:حجم الملف أكبر من ${mb}:mb: ميغابايت.`
        : $localize`:@@store.error.media-too-large:حجم الملف أو أبعاد الصورة أكبر من المسموح.`;
    }
    case 'media.image_required':
      return $localize`:@@store.error.media-image-required:اختر صورة منشورة من مكتبة الوسائط.`;
    case 'setting.unknown_key':
      return $localize`:@@store.error.setting-unknown-key:هذا الإعداد غير معروف.`;
    case 'setting.invalid_value':
      return $localize`:@@store.error.setting-invalid-value:القيمة غير صالحة أو تتعارض مع إعداد آخر (الحد الأدنى ≤ حد التبرع ≤ حد السلة).`;
    case 'category.not_found':
      return $localize`:@@store.error.category-not-found:لم نجد هذا التصنيف.`;
    case 'category.slug_taken':
      return $localize`:@@store.error.category-slug-taken:هذا الرابط مستخدم لتصنيف آخر.`;
    case 'project.not_found':
      return $localize`:@@store.error.project-not-found:هذا المشروع غير متاح.`;
    case 'project.slug_taken':
      return $localize`:@@store.error.project-slug-taken:هذا الرابط مستخدم لمشروع آخر (أو كان رابطًا سابقًا له).`;
    case 'project.publish_incomplete':
      return $localize`:@@store.error.project-publish-incomplete:لا يمكن النشر قبل استكمال البيانات المطلوبة.`;
    case 'project.invalid_transition':
      return $localize`:@@store.error.project-invalid-transition:لا يمكن نقل المشروع إلى هذه الحالة الآن.`;
    case 'project.option_label_taken': {
      const label = x['label'];
      return typeof label === 'string'
        ? $localize`:@@store.error.project-option-label-taken-value:الاسم «${label}:label:» مستخدم لخيار آخر في هذا المشروع.`
        : $localize`:@@store.error.project-option-label-taken:اسم الخيار مستخدم لخيار آخر في هذا المشروع.`;
    }
    case 'template.render_failed': {
      const line = x['line'];
      const column = x['column'];
      return typeof line === 'number'
        ? $localize`:@@store.error.template-render-failed-at:في القالب خطأ في الصياغة (السطر ${line}:line:، العمود ${String(column ?? '?')}:column:).`
        : $localize`:@@store.error.template-render-failed:في القالب خطأ في الصياغة.`;
    }
    default:
      if (problem.status >= 500 || problem.status === 0)
        return $localize`:@@store.error.fallback-server:حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.`;
      if (problem.status === 413)
        return $localize`:@@store.error.http-too-large:الملف أكبر من الحجم المسموح.`;
      return $localize`:@@store.error.fallback:تعذّر إتمام الطلب.`;
  }
}

/**
 * A field's validation error, by field name (API-6: the API's `errors{}` texts are English only). The key is the
 * camelCase field path from `errors` (`fullName`, `options[2].labelAr` …); indexes are ignored.
 */
export function fieldMessage(field: string): string {
  const leaf =
    field
      .replace(/\[\d+\]/g, '')
      .split('.')
      .pop() ?? field;
  switch (leaf) {
    case 'fullName':
    case 'name':
      return $localize`:@@store.error.field-name:أدخل اسمًا صحيحًا (حتى 120 حرفًا).`;
    case 'email':
      return $localize`:@@store.error.field-email:أدخل بريدًا إلكترونيًا صحيحًا.`;
    case 'mobile':
    case 'to':
      return $localize`:@@store.error.field-mobile:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`;
    case 'code':
      return $localize`:@@store.error.field-code:أدخل الرمز المكوّن من 6 أرقام.`;
    case 'amount':
    case 'minAmount':
      return $localize`:@@store.error.field-amount:أدخل مبلغًا صحيحًا بالريال (حتى منزلتين عشريتين).`;
    case 'quantity':
      return $localize`:@@store.error.field-quantity:أدخل كمية صحيحة.`;
    case 'slug':
      return $localize`:@@store.error.field-slug:الرابط من 2 إلى 80 حرفًا: حروف إنجليزية صغيرة وأرقام وشرطات.`;
    case 'labelAr':
      return $localize`:@@store.error.field-label:اسم الخيار بالعربية من 2 إلى 60 حرفًا.`;
    case 'titleAr':
    case 'nameAr':
      return $localize`:@@store.error.field-title-ar:العنوان بالعربية مطلوب.`;
    case 'sort':
      return $localize`:@@store.error.field-sort:الترتيب رقم من 0 إلى 10000.`;
    case 'newPassword':
      return $localize`:@@store.error.field-password:كلمة المرور من 12 إلى 128 حرفًا.`;
    case 'roles':
      return $localize`:@@store.error.field-roles:اختر دورًا واحدًا على الأقل.`;
    case 'body':
      return $localize`:@@store.error.field-body:نص القالب مطلوب.`;
    default:
      return $localize`:@@store.error.field-invalid:قيمة غير صالحة.`;
  }
}

/** Password weakness `reasons` (contract 15 §1.9) → text. */
export function passwordReason(reason: string): string {
  switch (reason) {
    case 'too_short':
      return $localize`:@@store.error.password-too-short:12 حرفًا على الأقل.`;
    case 'too_long':
      return $localize`:@@store.error.password-too-long:128 حرفًا على الأكثر.`;
    case 'common':
      return $localize`:@@store.error.password-common:كلمة مرور شائعة أو مكرّرة الأحرف.`;
    case 'same_as_current':
      return $localize`:@@store.error.password-same:تطابق كلمة المرور الحالية.`;
    default:
      return reason;
  }
}

/** Every R5 code with its own message — the unit test checks each one maps to a non-empty, code-specific text. */
export const R5_ERROR_CODES: readonly string[] = [
  'validation.failed',
  'http.not_found',
  'http.rate_limited',
  'http.origin_forbidden',
  'http.error',
  'server.error',
  'network.error',
  'concurrency.conflict',
  'db.duplicate',
  'db.reference_missing',
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
  'auth.totp_already_enrolled',
  'auth.totp_unavailable',
  'auth.password_change_required',
  'auth.password_weak',
  'auth.current_password_invalid',
  'otp.mobile_invalid',
  'otp.rate_limited',
  'otp.invalid',
  'otp.expired',
  'otp.too_many_attempts',
  'idempotency.key_required',
  'idempotency.key_reused',
  'idempotency.in_progress',
  'cart.target_unavailable',
  'cart.option_unavailable',
  'cart.open_amount_not_allowed',
  'cart.amount_below_minimum',
  'cart.amount_above_maximum',
  'cart.quantity_limit',
  'cart.too_many_lines',
  'cart.total_exceeded',
  'cart.line_not_found',
  'checkout.cart_empty',
  'checkout.lines_invalid',
  'checkout.contact_required',
  'order.not_found',
  'order.cancel_not_allowed',
  'staff.email_taken',
  'staff.last_admin',
  'media.alt_required',
  'media.type_not_allowed',
  'media.too_large',
  'media.image_required',
  'setting.unknown_key',
  'setting.invalid_value',
  'category.not_found',
  'category.slug_taken',
  'project.not_found',
  'project.slug_taken',
  'project.publish_incomplete',
  'project.invalid_transition',
  'project.option_label_taken',
  'template.render_failed',
];
