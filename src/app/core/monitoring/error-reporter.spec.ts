import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { STORE_API_URL } from '../api/store-api-url';
import {
  ERROR_REPORT_URL,
  ErrorReporter,
  MAX_REPORTS_PER_PAGE,
  ReportingErrorHandler,
  errorReportInterceptor,
  redactRoute,
  scrub,
} from './error-reporter';

const API = 'https://store-api.test/v1';

function setup(url: string, platform = 'browser') {
  const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchSpy);
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptors([errorReportInterceptor])),
      provideHttpClientTesting(),
      { provide: STORE_API_URL, useValue: API },
      { provide: ERROR_REPORT_URL, useValue: url },
      { provide: PLATFORM_ID, useValue: platform },
      ReportingErrorHandler,
    ],
  });
  return { reporter: TestBed.inject(ErrorReporter), fetchSpy };
}
const bodies = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));

describe('ErrorReporter (P5, PII-free)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redacts routes and scrubs messages', () => {
    expect(redactRoute('/ar/orders/T3-26-000123?t=abc#x')).toBe('/ar/orders/:ref');
    expect(redactRoute('/ar/account/donations/T3-26-9')).toBe('/ar/account/donations/:ref');
    expect(redactRoute('/en/p/water-wells')).toBe('/en/p/water-wells');
    const s = scrub(
      'user a.b@c.sa phone +966 55 123 4567 token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc\nnext',
    );
    expect(s).not.toMatch(/@|966|eyJ|\n/);
    expect(scrub('x'.repeat(500)).length).toBeLessThanOrEqual(200);
  });

  it('is off when the endpoint is empty (the default) or on the server', () => {
    let { reporter, fetchSpy } = setup('');
    reporter.report('error', 'TypeError', 'boom');
    expect(reporter.enabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    ({ reporter, fetchSpy } = setup('https://errors.test/r', 'server'));
    reporter.report('error', 'TypeError', 'boom');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a small JSON without credentials; dedupes; at most 10 per page', () => {
    const { reporter, fetchSpy } = setup('https://errors.test/r');
    reporter.report('error', 'TypeError', 'boom');
    reporter.report('error', 'TypeError', 'boom');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://errors.test/r');
    expect(init.credentials).toBe('omit');
    expect(init.keepalive).toBe(true);
    const body = bodies(fetchSpy)[0];
    expect(Object.keys(body).sort()).toEqual([
      'at',
      'build',
      'code',
      'env',
      'kind',
      'message',
      'route',
    ]);
    for (let i = 0; i < 20; i++) reporter.report('error', 'E', `m${i}`);
    expect(fetchSpy).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE);
  });

  it('reports failed store-API calls (network / 5xx) with the problem code, not 4xx', async () => {
    const { fetchSpy } = setup('https://errors.test/r');
    const http = TestBed.inject(HttpClient);
    const ctl = TestBed.inject(HttpTestingController);
    const a = firstValueFrom(http.get(`${API}/catalog/home`)).catch(() => null);
    ctl
      .expectOne(`${API}/catalog/home`)
      .flush({ code: 'server.unavailable' }, { status: 503, statusText: 'x' });
    const b = firstValueFrom(http.get(`${API}/orders/T3-26-000001/status?t=secret`)).catch(
      () => null,
    );
    ctl.expectOne(() => true).flush(null, { status: 500, statusText: 'x' });
    const c = firstValueFrom(http.get(`${API}/catalog/projects/x`)).catch(() => null);
    ctl
      .expectOne(`${API}/catalog/projects/x`)
      .flush({ code: 'project.not_found' }, { status: 404, statusText: 'x' });
    await Promise.all([a, b, c]);
    const sent = bodies(fetchSpy);
    expect(sent.map((r) => [r.kind, r.code, r.message])).toEqual([
      ['api', 'server.unavailable', 'GET /catalog/home'],
      ['api', 'http.500', 'GET /orders/:ref/status'],
    ]);
  });

  it('the ErrorHandler reports uncaught errors (name + message, no stack)', () => {
    const { fetchSpy } = setup('https://errors.test/r');
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.inject(ReportingErrorHandler).handleError(new RangeError('bad index 3'));
    expect(bodies(fetchSpy)[0]).toMatchObject({
      kind: 'error',
      code: 'RangeError',
      message: 'bad index 3',
    });
    expect(JSON.stringify(bodies(fetchSpy)[0])).not.toContain('at ');
    spyConsole.mockRestore();
  });
});
