import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StaffAuth } from '../auth/staff-auth';
import { StoreAuth } from '../auth/store-auth';
import type { StaffPolicy } from '../auth/policies';
import { CartSummary } from '../cart/cart-summary';

/** Signed-in customer, else /login?returnUrl=… (plan §2.2: account, orders). */
export const customerGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  return (await inject(StoreAuth).ensureSession()) ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** /login only for visitors who aren't signed in; a signed-in customer goes to the return URL or their account. */
export const guestOnlyGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  if (!(await inject(StoreAuth).ensureSession())) return true;
  const back = route.queryParamMap.get('returnUrl');
  return router.parseUrl(back && back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/\\') ? back : '/account/courses');
};

/** Checkout needs something to pay for (plan §2.2). */
export const cartNotEmptyGuard: CanActivateFn = async () => {
  const router = inject(Router);
  await inject(StoreAuth).ensureSession();
  const count = await inject(CartSummary).load();
  return count > 0 ? true : router.parseUrl('/cart');
};

/** Any signed-in staff user, else /admin/login. */
export const staffGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  return (await inject(StaffAuth).ensureSession()) ? true : router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
};

/** A staff screen needing a policy; without it, back to the dashboard (the side nav already hides such screens). */
export function staffPolicyGuard(policy: StaffPolicy): CanActivateFn {
  return async (_route, state) => {
    const router = inject(Router);
    const auth = inject(StaffAuth);
    if (!(await auth.ensureSession())) return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
    return auth.can(policy) ? true : router.parseUrl('/admin');
  };
}
