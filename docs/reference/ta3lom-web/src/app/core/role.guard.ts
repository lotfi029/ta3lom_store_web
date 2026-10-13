import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Session 2, Part 1: added ahead of /admin/audit and /admin/editors (Parts 3-4), which are
 * admin-role-only per docs/architecture/05-admin-shell.md and the API's own RolesGuard
 * (ta3lom-api/docs/architecture/05-auth-guards-audit.md). Like authGuard, this is a UX guard
 * only — API 403s enforce the real boundary regardless of what the client does. Assumes
 * authGuard has already run on the parent /admin route (so a session exists); an editor who is
 * authenticated but the wrong role is redirected to the overview, not the login screen.
 */
export function roleGuard(role: 'admin'): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const editor = auth.currentEditor();
    if (editor?.role === role) return true;
    return router.createUrlTree(['/admin/overview']);
  };
}
