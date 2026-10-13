import { HttpErrorResponse } from '@angular/common/http';
import type { FieldTree, TreeValidationResult } from '@angular/forms/signals';
import { ApiErrorBody, localizedCodeMessage } from './api-error-message';
import { I18nService } from './i18n';

/**
 * Maps the API's standard `{code, message, fields}` 400 error envelope (see
 * ta3lom-api's validation-exception-factory) onto the matching Signal Forms fields — `fields`
 * is already keyed by the same dot-path a FieldTree exposes, so no translation is needed.
 * A 429 (rate limit, FR-29) or anything else has no single field to blame; it's reported on
 * the form's own root instead, where a page-level banner can render it.
 *
 * `i18n` is optional and additive — passing it switches on `error.body.code` FIRST (per Part 3's
 * "switch on code, never on message" rule) to produce a localized root-level message for the
 * domain codes a content editor screen can hit even after client-side prevention (a save that
 * races a change elsewhere, or a case the disabled-publish-toggle trick can't cover, like a
 * thumbnail missing Arabic alt text). Existing callers that don't pass `i18n` keep the exact
 * prior behavior — the raw English `fields`/`message` fallback — so this is safe to add without
 * touching login/volunteer/membership/contact.
 */
export function mapSubmissionError<T>(
  fieldTree: FieldTree<T>,
  error: unknown,
  rateLimitMessage: string,
  genericMessage: string,
  i18n?: I18nService,
): TreeValidationResult {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    if (i18n && body?.code) {
      const localized = localizedCodeMessage(body, i18n);
      if (localized) return { kind: 'server', message: localized };
    }
    if (error.status === 400 && body?.fields) {
      // A key the form model doesn't have a field for — bodyAr/bodyEn on posts and programs are
      // the known case, kept out of the Signal Forms model deliberately (MarkdownEditor's
      // [(value)] two-way binds a plain WritableSignal, not a FieldTree) — used to attach to
      // `byKey[key] === undefined` and render nowhere at all (M2, admin-dashboard-code-review.md):
      // the save would fail with no on-screen indication whatsoever. Falling back to a root-level
      // entry (no `fieldTree`) means the page-level banner renders SOMETHING instead of silence,
      // for this field and any future one with the same gap.
      const byKey = fieldTree as unknown as Record<string, FieldTree<unknown> | undefined>;
      return Object.entries(body.fields).map(([key, message]) => {
        const target = byKey[key];
        return target ? { kind: 'server', message, fieldTree: target } : { kind: 'server', message };
      });
    }
    if (error.status === 429) {
      return { kind: 'server', message: rateLimitMessage };
    }
  }
  return { kind: 'server', message: genericMessage };
}
