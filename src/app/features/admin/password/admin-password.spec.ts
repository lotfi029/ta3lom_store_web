import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  Router,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { staffGuard } from '../../../core/guards/guards';
import { passwordOutcome } from './admin-password.page';

const API = 'https://store-api.test/v1';
const b64 = (o: object) =>
  btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (claims: object) => `h.${b64(claims)}.s`;
const session = (claims: object, mustChange = false) => ({
  accessToken: jwt(claims),
  expiresIn: 600,
  staff: {
    id: 's1',
    email: 'a@example.test',
    name: 'A',
    roles: ['admin'],
    mustChangePassword: mustChange,
    lastLoginAt: null,
  },
});
const problem = (status: number, body: object) =>
  new HttpErrorResponse({ status, error: { status, ...body } });

describe('/admin/password (C-6, E-3)', () => {
  let auth: StaffAuth;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    auth = TestBed.inject(StaffAuth);
    http = TestBed.inject(HttpTestingController);
  });

  const guard = () =>
    TestBed.runInInjectionContext(() =>
      staffGuard({} as ActivatedRouteSnapshot, { url: '/admin/projects' } as RouterStateSnapshot),
    );

  it('a reload while a change is pending restores a pwd_change token → /admin/password', async () => {
    const result = guard();
    http.expectOne(`${API}/admin/auth/refresh`).flush(session({ sub: 's1', pwd_change: 'true' }));
    const tree = (await result) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/admin/password');
    expect(auth.mustChangePassword()).toBe(true);
    expect(auth.can('staff:read')).toBe(false);
  });

  it('the claim decides even when the session body says otherwise; the cross-check alone also counts', async () => {
    const r1 = auth.ensureSession();
    http.expectOne(`${API}/admin/auth/refresh`).flush(session({ pwd_change: 'true' }, false));
    await r1;
    expect(auth.mustChangePassword()).toBe(true);
    auth.clear();
    TestBed.resetTestingModule();
  });

  it('a successful change swaps to the new tokens (no claim) and the admin opens', async () => {
    const r = auth.ensureSession();
    http.expectOne(`${API}/admin/auth/refresh`).flush(session({ pwd_change: 'true' }, true));
    await r;
    const change = auth.changePassword('old-one-time', 'a much longer new pass');
    const req = http.expectOne(`${API}/admin/auth/password`);
    expect(req.request.body).toEqual({
      currentPassword: 'old-one-time',
      newPassword: 'a much longer new pass',
    });
    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer h\./);
    req.flush(session({ sub: 's1' }));
    await change;
    expect(auth.mustChangePassword()).toBe(false);
    expect(auth.can('staff:admin')).toBe(true);
    expect(await guard()).toBe(true);
  });

  it('maps failures: weak reasons, wrong current password, lock and lost session', () => {
    const weak = passwordOutcome(
      problem(422, { code: 'auth.password_weak', reasons: ['too_short', 'common'] }),
    );
    expect(weak.field).toBe('next');
    expect(weak.reasons).toHaveLength(2);
    expect(weak.reasons[0]).toContain('12');
    expect(weak.signIn).toBe(false);

    const current = passwordOutcome(problem(422, { code: 'auth.current_password_invalid' }));
    expect(current.field).toBe('current');
    expect(current.reasons).toEqual([]);

    expect(passwordOutcome(problem(423, { code: 'auth.account_locked' })).signIn).toBe(true);
    expect(passwordOutcome(problem(401, { code: 'auth.unauthenticated' })).signIn).toBe(true);
  });
});
