import { HttpErrorResponse } from '@angular/common/http';
import { toInt } from './api.types';

/**
 * A store API error (RFC 9457 ProblemDetails + `code`, 11 §1.6). The OpenAPI document does not model the extension
 * members (`code`, `errors`, `lines`, `retryAfterSeconds`, `attemptsLeft`, `quote` …), so they are read defensively
 * here and nowhere else. The client switches on `code`, never on `title`.
 */
export interface StoreProblem {
  status: number;
  code: string;
  detail: string | null;
  /** Validation errors: camelCase field → messages. */
  errors: Record<string, string[]>;
  /** Every other extension member, as sent. */
  extra: Record<string, unknown>;
  /** `Retry-After` header or `retryAfterSeconds` body member (429). */
  retryAfterSeconds: number | null;
}

const KNOWN = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'code',
  'errors',
  'traceId',
]);

export function toProblem(error: unknown): StoreProblem {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: 0,
      code: 'network.error',
      detail: null,
      errors: {},
      extra: {},
      retryAfterSeconds: null,
    };
  }
  const body = (
    typeof error.error === 'object' && error.error !== null ? error.error : {}
  ) as Record<string, unknown>;
  const status = error.status;
  const code =
    typeof body['code'] === 'string'
      ? (body['code'] as string)
      : status === 0
        ? 'network.error'
        : status >= 500
          ? 'server.error'
          : status === 404
            ? 'http.not_found'
            : status === 429
              ? 'http.rate_limited'
              : 'http.error';
  const errors: Record<string, string[]> = {};
  if (body['errors'] && typeof body['errors'] === 'object') {
    for (const [k, v] of Object.entries(body['errors'] as Record<string, unknown>)) {
      errors[k.charAt(0).toLowerCase() + k.slice(1)] = Array.isArray(v)
        ? v.map(String)
        : [String(v)];
    }
  }
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (!KNOWN.has(k)) extra[k] = v;
  const header = error.headers?.get('Retry-After');
  const retry = body['retryAfterSeconds'] ?? header;
  return {
    status,
    code,
    detail: typeof body['detail'] === 'string' ? (body['detail'] as string) : null,
    errors,
    extra,
    retryAfterSeconds:
      retry === undefined || retry === null ? null : toInt(retry as string | number, 0) || null,
  };
}
