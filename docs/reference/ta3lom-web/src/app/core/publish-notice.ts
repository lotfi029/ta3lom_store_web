import { I18nService } from './i18n';

/**
 * What an editor is told after saving public content (CLAUDE.md "Rendering"; ADR-002).
 *
 * An ordinary visitor sees the change on their next page load — core/refresh-after-hydration.ts
 * reloads every public resource after the page boots — but prerendered HTML, which is all a crawler
 * (or anyone without JavaScript) ever sees, only catches up at the next rebuild. The admin must never
 * imply a change is instantly live everywhere, so every CR-01 content screen says it the same way.
 */
export function publishNotice(i18n: I18nService): string {
  return i18n.pick(
    'تم الحفظ. يظهر التغيير للزوار عند تحميلهم الصفحة التالي، ولمحركات البحث بعد إعادة بناء الموقع القادمة.',
    'Saved. Visitors see the change on their next page load; search engines after the next site rebuild.',
  );
}
