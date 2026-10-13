import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { OtpSignIn } from './otp-sign-in';
import { safeReturnUrl } from './login.page';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));

describe('OtpSignIn (10 §7.3, RUL-60)', () => {
  let http: HttpTestingController;

  function mount() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: STORE_API_URL, useValue: API }] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OtpSignIn);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, type };
  }

  async function toCodeStep(m: ReturnType<typeof mount>) {
    m.type('#otp-mobile', '٠٥٥١٢٣٤٥٦٧');
    m.el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const req = http.expectOne(`${API}/auth/otp/request`);
    expect(req.request.body).toEqual({ mobile: '0551234567', locale: 'ar' });
    req.flush({ expiresInSeconds: 300 }, { status: 202, statusText: 'Accepted' });
    await tick();
    m.fixture.detectChanges();
  }

  it('normalises the mobile, sends the code and moves to the code step', async () => {
    const m = mount();
    await toCodeStep(m);
    expect(m.el.querySelector('#otp-code')).not.toBeNull();
    expect(m.el.textContent).toContain('05•••••567');
  });

  it('rejects a non-Saudi number without calling the API', () => {
    const m = mount();
    m.type('#otp-mobile', '0112345678');
    m.el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    m.fixture.detectChanges();
    http.expectNone(`${API}/auth/otp/request`);
    expect(m.el.querySelector('.field-errors')?.textContent).toContain('05');
  });

  it('submits by itself when six digits are typed (Arabic-Indic too) and emits signedIn', async () => {
    const m = mount();
    const signed: unknown[] = [];
    m.fixture.componentInstance.signedIn.subscribe((s) => signed.push(s));
    await toCodeStep(m);
    m.type('#otp-code', '١٢٣٤٥٦');
    await tick();
    const req = http.expectOne(`${API}/auth/otp/verify`);
    expect(req.request.body).toEqual({ mobile: '0551234567', code: '123456' });
    req.flush({ accessToken: 'T', expiresIn: 900, customer: { id: 'c' }, cartNotices: [] });
    await tick();
    http.expectOne(`${API}/cart/summary`).flush({ lineCount: 0, grandTotal: '0.00' });
    await tick();
    expect(signed.length).toBe(1);
  });

  it('shows the attempts left on a wrong code', async () => {
    const m = mount();
    await toCodeStep(m);
    m.type('#otp-code', '000000');
    await tick();
    http.expectOne(`${API}/auth/otp/verify`).flush({ code: 'otp.invalid', attemptsLeft: 3 }, { status: 400, statusText: 'x' });
    await tick();
    m.fixture.detectChanges();
    expect(m.el.querySelector('[role=alert]')?.textContent).toContain('3');
  });

  it('shows the wait time when rate-limited', async () => {
    const m = mount();
    m.type('#otp-mobile', '0551234567');
    m.el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    http.expectOne(`${API}/auth/otp/request`).flush({ code: 'otp.rate_limited', retryAfterSeconds: 600 }, { status: 429, statusText: 'x' });
    await tick();
    m.fixture.detectChanges();
    expect(m.el.querySelector('[role=alert]')?.textContent).toContain('10');
  });

  it('explains a blocked account (RUL-61)', async () => {
    const m = mount();
    await toCodeStep(m);
    m.type('#otp-code', '123456');
    await tick();
    http.expectOne(`${API}/auth/otp/verify`).flush({ code: 'auth.account_blocked' }, { status: 403, statusText: 'x' });
    await tick();
    m.fixture.detectChanges();
    expect(m.el.querySelector('[role=alert]')?.textContent).toContain('تواصل مع الجمعية');
  });
});

describe('safeReturnUrl', () => {
  it('only accepts same-site paths', () => {
    expect(safeReturnUrl('/checkout')).toBe('/checkout');
    expect(safeReturnUrl('//evil.com')).toBe('/account/courses');
    expect(safeReturnUrl('https://evil.com')).toBe('/account/courses');
    expect(safeReturnUrl('/\\evil.com')).toBe('/account/courses');
    expect(safeReturnUrl(undefined)).toBe('/account/courses');
  });
});
