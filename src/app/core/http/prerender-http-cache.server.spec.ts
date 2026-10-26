import { prerenderUrl } from './prerender-http-cache.server';

describe('prerender API URL (C-1)', () => {
  const runtime = 'https://store-api.ta3lom.sa/v1';
  const stub = 'http://localhost:3000/v1';

  it('reads build-time data from PRERENDER_API_URL while the app keeps the runtime URL', () => {
    expect(prerenderUrl(`${runtime}/catalog/projects?page=1`, runtime, stub)).toBe(
      `${stub}/catalog/projects?page=1`,
    );
    expect(prerenderUrl(runtime, runtime, stub)).toBe(stub);
  });

  it('leaves other URLs and the default (no PRERENDER_API_URL) untouched', () => {
    expect(prerenderUrl('https://example.com/x', runtime, stub)).toBe('https://example.com/x');
    expect(prerenderUrl(`${runtime}/catalog/home`, runtime, undefined)).toBe(
      `${runtime}/catalog/home`,
    );
    expect(prerenderUrl(`${runtime}x/evil`, runtime, stub)).toBe(`${runtime}x/evil`);
  });
});
