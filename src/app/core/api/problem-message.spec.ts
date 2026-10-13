import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { R4_ERROR_CODES, problemMessage } from './problem-message';
import { toProblem } from './problem';

describe('problem → message (11 §1.6, r4)', () => {
  it('maps every r4 code to its own message', () => {
    const fallback = problemMessage({ code: 'nope', status: 400 });
    for (const code of R4_ERROR_CODES) {
      const msg = problemMessage({ code, status: 400 });
      expect(msg.length, code).toBeGreaterThan(5);
      if (code !== 'http.error') expect(msg, code).not.toBe(fallback);
    }
  });

  it('carries no giving codes', () => {
    expect(
      R4_ERROR_CODES.some((c) =>
        /campaign|zakat|dedication|allocation|beneficiary|card\.|offer\.|cause|goal|refund/.test(c),
      ),
    ).toBe(false);
  });

  it('reads code, field errors, extensions and Retry-After', () => {
    const p = toProblem(
      new HttpErrorResponse({
        status: 429,
        headers: new HttpHeaders({ 'Retry-After': '42' }),
        error: {
          code: 'otp.rate_limited',
          detail: 'x',
          errors: { Mobile: ['bad'] },
          retryAfterSeconds: 30,
          attemptsLeft: 2,
        },
      }),
    );
    expect(p.code).toBe('otp.rate_limited');
    expect(p.errors).toEqual({ mobile: ['bad'] });
    expect(p.retryAfterSeconds).toBe(30);
    expect(p.extra['attemptsLeft']).toBe(2);
  });

  it('derives a code when the body has none', () => {
    expect(toProblem(new HttpErrorResponse({ status: 503 })).code).toBe('server.error');
    expect(toProblem(new HttpErrorResponse({ status: 0 })).code).toBe('network.error');
    expect(toProblem(new Error('x')).code).toBe('network.error');
  });
});
