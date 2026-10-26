import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { StaffAuth } from '../auth/staff-auth';
import { StoreAuth } from '../auth/store-auth';
import type { StaffPolicy } from '../auth/policies';
import { CartSummary } from '../cart/cart-summary';

/** A same-site path the app may navigate back to (`/…`, never `//host` or `/\host`), else the fallback. */
export function safeReturnUrl(value: string | null | undefined, fallback: string): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : fallback;
}

/** Signed-in donor, else /login?returnUrl=… (account pages). */
export const customerGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  return (await inject(StoreAuth).ensureSession())
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** /login only for visitors who aren't signed in; a signed-in donor goes to the return URL or their donations. */
export const guestOnlyGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  if (!(await inject(StoreAuth).ensureSession())) return true;
  return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl'), '/account/donations'));
};

/** Checkout needs something to donate (the cart badge's line count, C-2). */
export const cartNotEmptyGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const summary = inject(CartSummary); // inject before the first await (NG0203)
  await inject(StoreAuth).ensureSession();
  const count = await summary.load();
  return count > 0 ? true : router.parseUrl('/cart');
};

/**
 * Any signed-in staff member, else /admin/login. While a forced password change is pending (the token's `pwd_change`
 * claim, C-6) every admin screen redirects to /admin/password — also after a reload, because the restored token
 * carries the claim again.
 */
export const staffGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const auth = inject(StaffAuth);
  if (!(await auth.ensureSession()))
    return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
  return auth.mustChangePassword() ? router.parseUrl('/admin/password') : true;
};

/** /admin/password: needs a staff session (forced or self-service change). */
export const staffSessionGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  return (await inject(StaffAuth).ensureSession())
    ? true
    : router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
};

/** A staff screen needing a policy; without it, back to the dashboard (the side nav already hides such screens). */
export function staffPolicyGuard(policy: StaffPolicy): CanActivateFn {
  return async (_route, state) => {
    const router = inject(Router);
    const auth = inject(StaffAuth);
    if (!(await auth.ensureSession()))
      return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
    if (auth.mustChangePassword()) return router.parseUrl('/admin/password');
    return auth.can(policy) ? true : router.parseUrl('/admin');
  };
}

/** A screen with edits that are not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a screen with unsaved edits (the project editor's per-section dirty state). */
/**
 * F-6: the browser's own "leave site?" prompt while edits are unsaved — the route guard above cannot see a reload, a
 * closed tab or a typed address. Call from a constructor (injection context); the listener goes with the component.
 */
export function warnBeforeUnload(hasUnsaved: () => boolean): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const onUnload = (e: BeforeUnloadEvent) => {
    if (!hasUnsaved()) return;
    e.preventDefault();
    e.returnValue = ''; // older browsers show the prompt only when this is set
  };
  window.addEventListener('beforeunload', onUnload);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', onUnload));
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  confirm(
    $localize`:@@store.admin.unsaved-leave:لديك تعديلات غير محفوظة. هل تريد مغادرة الصفحة وتجاهلها؟`,
  );
