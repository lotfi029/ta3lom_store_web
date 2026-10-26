import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { StaffAuth } from '../auth/staff-auth';
import { StoreAuth } from '../auth/store-auth';
import { CartSummary } from '../cart/cart-summary';
import {
  cartNotEmptyGuard,
  guestOnlyGuard,
  safeReturnUrl,
  staffGuard,
  staffPolicyGuard,
  warnBeforeUnload,
} from './guards';

const state = (url: string) => ({ url }) as RouterStateSnapshot;
const route = (q: Record<string, string> = {}) =>
  ({ queryParamMap: { get: (k: string) => q[k] ?? null } }) as unknown as ActivatedRouteSnapshot;

describe('guards', () => {
  let signedIn = false;
  let count = 0;
  let staffIn = true;
  let mustChange = false;
  let canDo = true;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // Resolve asynchronously, like the real services: inject() after an await would throw NG0203.
        { provide: StoreAuth, useValue: { ensureSession: () => Promise.resolve(signedIn) } },
        { provide: CartSummary, useValue: { load: () => Promise.resolve(count) } },
        {
          provide: StaffAuth,
          useValue: {
            ensureSession: () => Promise.resolve(staffIn),
            mustChangePassword: () => mustChange,
            can: () => canDo,
          },
        },
      ],
    });
  });

  const run = (guard: typeof cartNotEmptyGuard, r = route(), url = '/checkout') =>
    TestBed.runInInjectionContext(() => guard(r, state(url))) as Promise<boolean | UrlTree>;
  const path = (v: boolean | UrlTree) =>
    v instanceof UrlTree ? TestBed.inject(Router).serializeUrl(v) : v;

  it('checkout: an empty cart goes back to /cart, a cart with lines passes', async () => {
    count = 0;
    expect(path(await run(cartNotEmptyGuard))).toBe('/cart');
    count = 2;
    expect(await run(cartNotEmptyGuard)).toBe(true);
  });

  it('login: a signed-in donor goes to a safe return URL, else to their donations', async () => {
    signedIn = true;
    expect(path(await run(guestOnlyGuard, route({ returnUrl: '/checkout' })))).toBe('/checkout');
    expect(path(await run(guestOnlyGuard, route({ returnUrl: '//evil.example' })))).toBe(
      '/account/donations',
    );
    signedIn = false;
    expect(await run(guestOnlyGuard)).toBe(true);
  });

  it('return URLs stay on this site', () => {
    expect(safeReturnUrl('/a?b=1', '/x')).toBe('/a?b=1');
    for (const bad of ['//evil', '/\\evil', 'https://evil', '', null])
      expect(safeReturnUrl(bad, '/x')).toBe('/x');
  });

  it('C-6: a pending password change sends every admin screen to /admin/password (also after a reload)', async () => {
    staffIn = true;
    mustChange = true;
    expect(path(await run(staffGuard, route(), '/admin/projects'))).toBe('/admin/password');
    expect(path(await run(staffPolicyGuard('staff:admin'), route(), '/admin/staff'))).toBe(
      '/admin/password',
    );
    mustChange = false;
    expect(await run(staffGuard, route(), '/admin')).toBe(true);
  });

  it('staff: no session → login with return URL; missing policy → dashboard', async () => {
    staffIn = false;
    expect(path(await run(staffGuard, route(), '/admin/orders'))).toBe(
      '/admin/login?returnUrl=%2Fadmin%2Forders',
    );
    staffIn = true;
    mustChange = false;
    canDo = false;
    expect(path(await run(staffPolicyGuard('staff:admin'), route(), '/admin/audit'))).toBe(
      '/admin',
    );
  });
});

describe('warnBeforeUnload (F-6)', () => {
  let dirty = false;

  @Component({ template: '' })
  class Editor {
    constructor() {
      warnBeforeUnload(() => dirty);
    }
  }

  const unload = () => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  };

  it('asks before the tab closes or reloads only while there are unsaved edits, and stops when destroyed', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Editor);
    dirty = false;
    expect(unload()).toBe(false);
    dirty = true;
    expect(unload()).toBe(true);
    fixture.destroy();
    expect(unload()).toBe(false);
  });
});
