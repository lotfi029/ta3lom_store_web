import { TestBed } from '@angular/core/testing';
import { type StaffRole, rolesAllow } from '../../../core/auth/policies';
import { OpsData } from '../ops/ops.data';
import { ADMIN_SECTIONS, visibleNav } from './admin-nav';
import { activeNavKey, routeTitle } from './admin-shell';
import { AdminShellData, COUNTS_THROTTLE_MS } from './admin-shell.data';

const keys = (role: StaffRole) =>
  visibleNav((p) => rolesAllow([role], p)).flatMap((s) => s.items.map((i) => i.key));

describe('admin nav (W-A1)', () => {
  it('filters the sections per role, as the API policies do', () => {
    const read = ['home', 'orders', 'projects', 'media', 'donors'];
    expect(keys('admin')).toEqual([
      ...read,
      'reports',
      'orphans',
      'templates',
      'audit',
      'staff',
      'settings',
    ]);
    expect(keys('store_manager')).toEqual([...read, 'templates']);
    expect(keys('finance')).toEqual([...read, 'reports', 'orphans']);
    expect(keys('viewer')).toEqual(read);
  });

  it('leaves out sections with nothing to show', () => {
    expect(visibleNav((p) => rolesAllow(['viewer'], p)).map((s) => s.key)).toEqual(['main']);
  });

  it('keeps every existing admin screen reachable from the nav (no route lost)', () => {
    const paths = ADMIN_SECTIONS.flatMap((s) =>
      s.items.flatMap((i) => [i.path, ...(i.children ?? []).map((c) => c.path)]),
    );
    for (const p of [
      '/admin',
      '/admin/orders',
      '/admin/projects',
      '/admin/categories',
      '/admin/media',
      '/admin/donors',
      '/admin/reports',
      '/admin/payments/orphans',
      '/admin/templates',
      '/admin/audit',
      '/admin/staff',
      '/admin/settings',
    ])
      expect(paths).toContain(p);
  });

  it('finds the active section from the URL (sub-pages and sub-items included)', () => {
    const items = ADMIN_SECTIONS.flatMap((s) => s.items);
    expect(activeNavKey('/admin', items)).toBe('home');
    expect(activeNavKey('/admin/orders?status=paid', items)).toBe('orders');
    expect(activeNavKey('/admin/orders/T3-26-000001', items)).toBe('orders');
    expect(activeNavKey('/admin/projects/abc', items)).toBe('projects');
    expect(activeNavKey('/admin/categories', items)).toBe('projects');
    expect(activeNavKey('/admin/payments/orphans', items)).toBe('orphans');
    expect(activeNavKey('/admin/menu', items)).toBeNull();
  });

  it('reads the deepest route title', () => {
    const snap = {
      data: {},
      firstChild: { data: { title: 'A' }, firstChild: { data: { title: 'B' }, firstChild: null } },
    };
    expect(routeTitle(snap as never)).toBe('B');
    expect(routeTitle(null)).toBe('');
  });
});

describe('admin shell counts (W-A1)', () => {
  it('reloads the dashboard at most once per 30 s', () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OpsData,
          useValue: {
            dashboard: {
              reload,
              value: () => undefined,
              hasValue: () => false,
              error: () => undefined,
            },
          },
        },
      ],
    });
    const shell = TestBed.inject(AdminShellData);
    shell.refresh(1_000_000);
    shell.refresh(1_000_000 + COUNTS_THROTTLE_MS - 1);
    expect(reload).toHaveBeenCalledTimes(1);
    shell.refresh(1_000_000 + COUNTS_THROTTLE_MS);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
