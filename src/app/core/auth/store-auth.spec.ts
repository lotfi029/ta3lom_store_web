import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../api/store-api-url';
import { StoreAuth } from './store-auth';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const ME = {
  id: 'c',
  mobile: '+966551234567',
  fullName: 'سارة',
  email: 's@example.com',
  locale: 'ar',
  marketingOptIn: false,
  status: 'active',
  pdplConsentAt: null,
  createdAt: '2026-10-25T00:00:00+00:00',
};

describe('StoreAuth (contract 15 §2.2)', () => {
  let auth: StoreAuth;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    auth = TestBed.inject(StoreAuth);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('refreshes once for parallel callers (single-flight) with credentials', async () => {
    const a = auth.refresh();
    const b = auth.refresh();
    const req = http.expectOne(`${API}/auth/refresh`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ accessToken: 'T1', expiresIn: 900 });
    await tick();
    http.expectOne(`${API}/me`).flush(ME);
    expect(await a).toBe('T1');
    expect(await b).toBe('T1');
    expect(auth.accessToken()).toBe('T1');
  });

  it('clears the token when the refresh fails', async () => {
    const first = auth.refresh();
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T1', expiresIn: 900 });
    await tick();
    http.expectOne(`${API}/me`).flush(ME);
    await first;
    const failing = auth.refresh();
    http
      .expectOne(`${API}/auth/refresh`)
      .flush({ code: 'auth.refresh_invalid' }, { status: 401, statusText: 'x' });
    await expect(failing).rejects.toBeTruthy();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isSignedIn()).toBe(false);
  });

  it('retries once on auth.refresh_race (409)', async () => {
    const p = auth.refresh();
    http
      .expectOne(`${API}/auth/refresh`)
      .flush({ code: 'auth.refresh_race' }, { status: 409, statusText: 'x' });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T2', expiresIn: 900 });
    await tick();
    http.expectOne(`${API}/me`).flush(ME);
    expect(await p).toBe('T2');
  });

  it('never writes the token to web storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const verify = auth.verifyOtp('0551234567', '123456');
    const req = http.expectOne(`${API}/auth/otp/verify`);
    expect(req.request.body).toEqual({ mobile: '0551234567', code: '123456' });
    req.flush({
      accessToken: 'SECRET',
      expiresIn: 900,
      customer: {
        id: 'c',
        mobile: '+966551234567',
        fullName: null,
        email: null,
        locale: 'ar',
        isNew: true,
        profileComplete: false,
      },
      cartNotices: [{ code: 'cart.merge_combined', lineId: 'l1' }],
    });
    await verify;
    auth.refresh().catch(() => undefined);
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'SECRET2', expiresIn: 900 });
    await new Promise((r) => setTimeout(r));
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).not.toContain('SECRET');
    expect(auth.cartNotices().length).toBe(1);
    setItem.mockRestore();
  });

  it('W-2: a restored session loads /v1/me with the new bearer, so the menu has the name and mobile', async () => {
    const restored = auth.ensureSession();
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T9', expiresIn: 900 });
    await tick();
    const me = http.expectOne(`${API}/me`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer T9');
    me.flush(ME);
    expect(await restored).toBe(true);
    expect(auth.customer()?.fullName).toBe('سارة');
    expect(auth.customer()?.mobile).toBe('+966551234567');
  });

  it('W-2: a later refresh does not reload /me when the profile is known', async () => {
    const first = auth.refresh();
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T1', expiresIn: 900 });
    await tick();
    http.expectOne(`${API}/me`).flush(ME);
    await first;
    const second = auth.refresh();
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T2', expiresIn: 900 });
    expect(await second).toBe('T2');
    http.expectNone(`${API}/me`);
  });

  it('ensureSession tries one refresh per page view', async () => {
    const first = auth.ensureSession();
    http.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'x' });
    expect(await first).toBe(false);
    expect(await auth.ensureSession()).toBe(false);
    http.expectNone(`${API}/auth/refresh`);
  });

  it('logout clears the session even when the API call fails', async () => {
    const p = auth.logout();
    http.expectOne(`${API}/auth/logout`).flush({}, { status: 500, statusText: 'x' });
    await expect(p).rejects.toBeTruthy();
    expect(auth.isSignedIn()).toBe(false);
  });
});
