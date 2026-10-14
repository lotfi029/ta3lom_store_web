import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { StoreAuth } from '../auth/store-auth';
import { CartSummary } from '../cart/cart-summary';
import { cartNotEmptyGuard, thanksAccessGuard } from './guards';

const state = (url: string) => ({ url }) as RouterStateSnapshot;
const route = (t: string | null) =>
  ({
    queryParamMap: { get: (k: string) => (k === 't' ? t : null) },
  }) as unknown as ActivatedRouteSnapshot;

describe('guards', () => {
  let signedIn = false;
  let count = 0;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // Resolve asynchronously, like the real services: inject() after an await would throw NG0203.
        { provide: StoreAuth, useValue: { ensureSession: () => Promise.resolve(signedIn) } },
        { provide: CartSummary, useValue: { load: () => Promise.resolve(count) } },
      ],
    });
  });

  const run = (guard: typeof cartNotEmptyGuard, r = route(null), url = '/checkout') =>
    TestBed.runInInjectionContext(() => guard(r, state(url))) as Promise<boolean | UrlTree>;
  const path = (v: boolean | UrlTree) =>
    v instanceof UrlTree ? TestBed.inject(Router).serializeUrl(v) : v;

  it('checkout: an empty cart goes back to /cart, a cart with lines passes', async () => {
    count = 0;
    expect(path(await run(cartNotEmptyGuard))).toBe('/cart');
    count = 2;
    expect(await run(cartNotEmptyGuard)).toBe(true);
  });

  it('thanks: the session, else a status token, else sign in first', async () => {
    signedIn = true;
    expect(await run(thanksAccessGuard, route(null), '/orders/T3-1/thanks')).toBe(true);
    signedIn = false;
    expect(await run(thanksAccessGuard, route('st'), '/orders/T3-1/thanks?t=st')).toBe(true);
    expect(path(await run(thanksAccessGuard, route(null), '/orders/T3-1/thanks'))).toBe(
      '/login?returnUrl=%2Forders%2FT3-1%2Fthanks',
    );
  });
});
