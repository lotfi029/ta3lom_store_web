import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../api/store-api-url';
import { StoreAuth } from './store-auth';

const API = 'https://store-api.test/v1';

describe('StoreAuth (plan §6)', () => {
  let auth: StoreAuth;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: STORE_API_URL, useValue: API }],
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
    expect(await a).toBe('T1');
    expect(await b).toBe('T1');
    expect(auth.accessToken()).toBe('T1');
  });

  it('clears the token when the refresh fails', async () => {
    const first = auth.refresh();
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T1', expiresIn: 900 });
    await first;
    const failing = auth.refresh();
    http.expectOne(`${API}/auth/refresh`).flush({ code: 'auth.refresh_invalid' }, { status: 401, statusText: 'x' });
    await expect(failing).rejects.toBeTruthy();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isSignedIn()).toBe(false);
  });

  it('retries once on auth.refresh_race (409)', async () => {
    const p = auth.refresh();
    http.expectOne(`${API}/auth/refresh`).flush({ code: 'auth.refresh_race' }, { status: 409, statusText: 'x' });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));
    http.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'T2', expiresIn: 900 });
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
      customer: { id: 'c', mobile: '+966551234567', fullName: null, email: null, locale: 'ar', anonymousDefault: false, isNew: true, profileComplete: false },
      cartNotices: [{ code: 'course_owned' }],
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
