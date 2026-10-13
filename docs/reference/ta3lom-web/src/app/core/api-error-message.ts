import { I18nService } from './i18n';

/** One row of `references` on a 409 IN_USE body — what still points at the thing being deleted. */
export interface ApiReference {
  entity: string;
  id: string;
  titleAr: string;
  relation: string;
}

/**
 * The CR-01 membership-field 409 IN_USE `references` shape — what still uses a field is a set of
 * APPLICATIONS (personal data), so the API sends a count and ids only, never names (PDPL).
 * `submissionIds` is capped at the newest 20; `count` is the full total. The UI shows the count and
 * never lists the ids.
 */
export interface ApiReferenceCount {
  count: number;
  submissionIds?: string[];
}

/** The API's standard `{code, message, fields, references, assets}` error envelope (see
 *  ta3lom-api's validation-exception-factory and its various domain exceptions). */
export interface ApiErrorBody {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
  references?: ApiReference[] | ApiReferenceCount;
  assets?: { id: string; originalName: string }[];
}

/** How many things a 409 IN_USE body says still reference the record, whichever shape it uses. */
export function referenceCount(references: ApiErrorBody['references']): number {
  if (Array.isArray(references)) return references.length;
  return references?.count ?? 0;
}

/**
 * Extracted from signal-forms.util.ts's mapSubmissionError, which was the only caller — the
 * eleven admin delete flows (core/delete-flow.ts) need the exact same code→message switch and
 * had no way to reach it while it lived as a module-private function there.
 *
 * The domain codes named in the Part 3 spec: THUMBNAIL_REQUIRED, FILE_REQUIRED,
 * ALT_TEXT_REQUIRED, CATEGORY_SCOPE_MISMATCH, REORDER_INCOMPLETE, INVALID_YOUTUBE_ID, IN_USE,
 * LAST_ADMIN. Returns null for anything else so the caller falls through to its own
 * `fields`/generic handling.
 */
export function localizedCodeMessage(body: ApiErrorBody, i18n: I18nService): string | null {
  switch (body.code) {
    case 'THUMBNAIL_REQUIRED':
      return i18n.pick('لا يمكن النشر بلا صورة مصغّرة.', 'Cannot publish without a thumbnail.');
    case 'FILE_REQUIRED':
      return i18n.pick('لا يمكن النشر بلا ملف.', 'Cannot publish without a file.');
    case 'ALT_TEXT_REQUIRED': {
      const names = (body.assets ?? []).map((a) => a.originalName).join('، ');
      return i18n.pick(
        `لا يمكن النشر — الصور التالية بلا نص بديل بالعربية: ${names || '—'}.`,
        `Cannot publish — these images have no Arabic alt text: ${names || '—'}.`,
      );
    }
    case 'CATEGORY_SCOPE_MISMATCH':
      return i18n.pick('هذا التصنيف لا يطابق نطاق هذه الشاشة.', 'This category does not match this screen’s scope.');
    case 'REORDER_INCOMPLETE':
      return i18n.pick('يجب إرسال كل العناصر عند إعادة الترتيب.', 'Reordering must include every item in the group.');
    case 'INVALID_YOUTUBE_ID':
      return i18n.pick('رابط يوتيوب غير صالح.', 'That is not a valid YouTube link.');
    case 'IN_USE': {
      const count = referenceCount(body.references);
      return i18n.pick(`مستخدم في ${count} عنصر — أعد تصنيف هذه العناصر أولاً.`, `In use by ${count} item(s) — reassign them first.`);
    }
    case 'LAST_ADMIN':
      return i18n.pick('لا يمكن إزالة آخر مشرف في النظام.', 'The last remaining admin cannot be removed.');
    // CR-01
    case 'PRIMARY_LICENCE':
      return i18n.pick(
        'لا يمكن حذف الترخيص الأساسي أو إلغاء تعيينه — اجعل ترخيصًا آخر أساسيًا أولًا.',
        "The primary licence can't be deleted or un-marked — make another licence primary first.",
      );
    case 'MANAGED_BY_LICENCE':
      return i18n.pick(
        'رقم الترخيص يُدار الآن من صفحة «التراخيص» — عدّل رقم الترخيص الأساسي هناك.',
        'The licence number is now managed in Licences — edit the primary licence’s number there.',
      );
    case 'CONSENT_REQUIRED':
      return i18n.pick('لا يمكن النشر دون موافقة صاحب الرأي.', "Can't publish without the person’s consent.");
    case 'MEDIA_KIND_MISMATCH':
      return i18n.pick('نوع الوسائط لا يناسب نوع البطاقة.', 'That media type does not fit this kind of card.');
    default:
      return null;
  }
}
