import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type Route,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { routes } from '../../app.routes';
import { SHOWCASE } from '../showcase/showcase';
import { showcaseGuard } from './guards';

/** SW-3: in showcase the donor-only routes go to the locale home before their page loads (no flash). */
describe('showcaseGuard', () => {
  const setup = (showcase: boolean) =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SHOWCASE, useValue: showcase }],
    });
  const run = () =>
    TestBed.runInInjectionContext(() =>
      showcaseGuard({} as ActivatedRouteSnapshot, { url: '/cart' } as RouterStateSnapshot),
    ) as boolean | UrlTree;

  it('showcase: redirects to the locale home', () => {
    setup(true);
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  it('live: lets the route through', () => {
    setup(false);
    expect(run()).toBe(true);
  });

  it('guards cart, checkout, orders/:ref, account and login — first — and never admin, home or a project', () => {
    const children = routes.find((r) => r.path === '' && r.children)!.children!;
    const guarded = (r: Route) => (r.canActivate ?? [])[0] === showcaseGuard;
    for (const path of ['cart', 'checkout', 'orders/:ref', 'account', 'login'])
      expect(guarded(children.find((r) => r.path === path)!), path).toBe(true);
    for (const path of ['', 'p/:slug', '**'])
      expect(guarded(children.find((r) => r.path === path)!), path).toBe(false);
    expect(routes.find((r) => r.path === 'admin')!.canActivate).toBeUndefined();
  });
});
