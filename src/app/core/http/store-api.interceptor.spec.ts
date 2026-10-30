import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { STORE_API_URL } from '../api/store-api-url';
import { StaffAuth } from '../auth/staff-auth';
import { StoreAuth } from '../auth/store-auth';
import { storeApiInterceptor } from './store-api.interceptor';

const API = 'https://store-api.test/v1';

describe('storeApiInterceptor (plan §6 "Interceptors")', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([storeApiInterceptor])),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctl.verify());

  async function signInCustomer(token: string) {
    const auth = TestBed.inject(StoreAuth);
    const p = auth.refresh();
    ctl.expectOne(`${API}/auth/refresh`).flush({ accessToken: token, expiresIn: 900 });
    await new Promise((r) => setTimeout(r));
    ctl
      .expectOne(`${API}/me`)
      .flush({ id: 'c', mobile: '+966551234567', fullName: null, email: null, locale: 'ar' });
    await p;
  }
  async function signInStaff(token: string) {
    const auth = TestBed.inject(StaffAuth);
    const p = auth.refresh();
    ctl.expectOne(`${API}/admin/auth/refresh`).flush({
      accessToken: token,
      expiresIn: 600,
      staff: { id: 's', email: 'a@b', name: 'A', roles: ['admin'], lastLoginAt: null },
    });
    await p;
  }

  it('sends credentials and the bearer to the store API only', async () => {
    await signInCustomer('CUST');
    http.get('https://cdn.example.com/x').subscribe();
    const other = ctl.expectOne('https://cdn.example.com/x');
    expect(other.request.withCredentials).toBe(false);
    expect(other.request.headers.has('Authorization')).toBe(false);
    other.flush({});

    http.get(`${API}/cart`).subscribe();
    const own = ctl.expectOne(`${API}/cart`);
    expect(own.request.withCredentials).toBe(true);
    expect(own.request.headers.get('Authorization')).toBe('Bearer CUST');
    own.flush({});
  });

  it('does not treat a look-alike origin as the store API', async () => {
    await signInCustomer('CUST');
    http.get('https://store-api.test/v1.evil.com/x').subscribe();
    const r = ctl.expectOne('https://store-api.test/v1.evil.com/x');
    expect(r.request.headers.has('Authorization')).toBe(false);
    r.flush({});
  });

  it('uses the staff token for /admin and the customer token elsewhere', async () => {
    await signInCustomer('CUST');
    await signInStaff('STAFF');
    http.get(`${API}/admin/orders`).subscribe();
    const admin = ctl.expectOne(`${API}/admin/orders`);
    expect(admin.request.headers.get('Authorization')).toBe('Bearer STAFF');
    admin.flush({});
    http.get(`${API}/me`).subscribe();
    const me = ctl.expectOne(`${API}/me`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer CUST');
    me.flush({});
  });

  it('refreshes once on 401 and retries the request once', async () => {
    await signInCustomer('OLD');
    const result = firstValueFrom(http.get<{ ok: boolean }>(`${API}/me`));
    ctl
      .expectOne(`${API}/me`)
      .flush({ code: 'auth.unauthenticated' }, { status: 401, statusText: 'x' });
    await new Promise((r) => setTimeout(r));
    ctl.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'NEW', expiresIn: 900 });
    await new Promise((r) => setTimeout(r));
    const retry = ctl.expectOne(`${API}/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer NEW');
    retry.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('gives up after one retry (a second 401 propagates)', async () => {
    await signInCustomer('OLD');
    const result = firstValueFrom(http.get(`${API}/me`));
    ctl.expectOne(`${API}/me`).flush({}, { status: 401, statusText: 'x' });
    await new Promise((r) => setTimeout(r));
    ctl.expectOne(`${API}/auth/refresh`).flush({ accessToken: 'NEW', expiresIn: 900 });
    await new Promise((r) => setTimeout(r));
    ctl.expectOne(`${API}/me`).flush({}, { status: 401, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 401 });
  });

  it('propagates the original 401 when the refresh fails', async () => {
    const result = firstValueFrom(http.get(`${API}/me`));
    ctl.expectOne(`${API}/me`).flush({}, { status: 401, statusText: 'x' });
    await new Promise((r) => setTimeout(r));
    ctl.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 401 });
  });

  it('a refused staff refresh goes to /admin/login; a transient one keeps the staff member on the screen', async () => {
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await signInStaff('STAFF');

    const transient = firstValueFrom(http.get(`${API}/admin/orders`));
    ctl.expectOne(`${API}/admin/orders`).flush({}, { status: 401, statusText: 'x' });
    await new Promise((r) => setTimeout(r));
    ctl.expectOne(`${API}/admin/auth/refresh`).flush({}, { status: 503, statusText: 'x' });
    await expect(transient).rejects.toMatchObject({ status: 401 });
    expect(nav).not.toHaveBeenCalled();
    expect(TestBed.inject(StaffAuth).accessToken()).toBe('STAFF');

    const refused = firstValueFrom(http.get(`${API}/admin/orders`));
    ctl.expectOne(`${API}/admin/orders`).flush({}, { status: 401, statusText: 'x' });
    await new Promise((r) => setTimeout(r));
    ctl
      .expectOne(`${API}/admin/auth/refresh`)
      .flush({ code: 'auth.refresh_expired' }, { status: 401, statusText: 'x' });
    await expect(refused).rejects.toMatchObject({ status: 401 });
    expect(nav).toHaveBeenCalledWith(['/admin/login'], expect.anything());
    expect(TestBed.inject(StaffAuth).isSignedIn()).toBe(false);
  });

  it('C-6 backstop: 403 auth.password_change_required on a staff call goes to /admin/password', async () => {
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const result = firstValueFrom(http.get(`${API}/admin/dashboard`));
    ctl
      .expectOne(`${API}/admin/dashboard`)
      .flush({ code: 'auth.password_change_required' }, { status: 403, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(nav).toHaveBeenCalledWith('/admin/password');
  });
});
