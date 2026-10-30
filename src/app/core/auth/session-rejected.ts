import { HttpErrorResponse } from '@angular/common/http';

/**
 * A refresh the API refused for good: 401 (`auth.refresh_invalid|expired|reused`, cookie cleared by the API) or 403
 * `auth.account_blocked`. Anything else — network error, 5xx, 429, a second `auth.refresh_race` — leaves the refresh cookie
 * as it was, so the session must not be dropped: the next guard or request tries again.
 */
export function sessionRejected(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  const code = (error.error as { code?: unknown } | null)?.code;
  return error.status === 401 || (error.status === 403 && code === 'auth.account_blocked');
}
