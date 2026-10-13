import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Checks the token signal; on cold load (a fresh tab has no in-memory access token yet —
 * see ADR-006) attempts a silent refresh before redirecting to login. This is a UX guard
 * only, never a security control — the API enforces auth on every request regardless.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.accessToken()) {
    return true;
  }

  const refreshed = await auth.silentRefresh();
  return refreshed ? true : router.createUrlTree(['/admin/login']);
};
