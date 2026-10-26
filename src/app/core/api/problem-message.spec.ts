import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { R5_ERROR_CODES, fieldMessage, passwordReason, problemMessage } from './problem-message';
import { toProblem } from './problem';

describe('problem → message (contract 15 §4, R5)', () => {
  it('maps every R5 code to its own message', () => {
    const fallback = problemMessage({ code: 'nope', status: 400 });
    for (const code of R5_ERROR_CODES) {
      const msg = problemMessage({ code, status: 400 });
      expect(msg.length, code).toBeGreaterThan(5);
      if (code !== 'http.error') expect(msg, code).not.toBe(fallback);
    }
  });

  it('carries no r4 commerce codes', () => {
    expect(
      R5_ERROR_CODES.some((c) =>
        /^(catalog|download|document|shipment)\.|out_of_st|address/.test(c),
      ),
    ).toBe(false);
  });

  it('puts the limit values of the extension members into the text', () => {
    expect(
      problemMessage({ code: 'cart.amount_below_minimum', status: 422, extra: { min: '10.00' } }),
    ).toContain('10');
    expect(
      problemMessage({ code: 'cart.total_exceeded', status: 422, extra: { max: '100000.00' } }),
    ).toContain('100,000');
    expect(
      problemMessage({ code: 'cart.too_many_lines', status: 422, extra: { max: 50 } }),
    ).toContain('50');
    expect(
      problemMessage({ code: 'otp.invalid', status: 400, extra: { attemptsLeft: 2 } }),
    ).toContain('2');
    expect(
      problemMessage({
        code: 'project.option_label_taken',
        status: 422,
        extra: { label: 'كفالة يوم' },
      }),
    ).toContain('كفالة يوم');
    expect(
      problemMessage({
        code: 'template.render_failed',
        status: 422,
        extra: { line: 3, column: 7 },
      }),
    ).toContain('3');
  });

  it('shows the media limit in MB (max is bytes) and handles a bare 413', () => {
    expect(
      problemMessage({ code: 'media.too_large', status: 413, extra: { max: 10485760 } }),
    ).toContain('10');
    expect(problemMessage({ code: 'http.error', status: 413 })).not.toBe(
      problemMessage({ code: 'http.error', status: 400 }),
    );
  });

  it('maps English field errors by field, ignoring indexes (API-6)', () => {
    expect(fieldMessage('options[2].labelAr')).toBe(fieldMessage('labelAr'));
    expect(fieldMessage('email')).not.toBe(fieldMessage('unknownField'));
    expect(passwordReason('too_short')).not.toBe('too_short');
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

  it('reads order.cancel_not_allowed with the order state in orderStatus', () => {
    const body = { status: 409, code: 'order.cancel_not_allowed', orderStatus: 'cancelled' };
    const p = toProblem(new HttpErrorResponse({ status: 409, error: body }));
    expect(p.status).toBe(409);
    expect(p.code).toBe('order.cancel_not_allowed');
    expect(p.extra['orderStatus']).toBe('cancelled');
  });

  it('derives a code when the body has none', () => {
    expect(toProblem(new HttpErrorResponse({ status: 503 })).code).toBe('server.error');
    expect(toProblem(new HttpErrorResponse({ status: 0 })).code).toBe('network.error');
    expect(toProblem(new Error('x')).code).toBe('network.error');
  });
});
