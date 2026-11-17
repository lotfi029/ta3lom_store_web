import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { roleLabel } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { LangSwitch } from '../../../layout/lang-switch/lang-switch';
import { SkipLink } from '../../../layout/skip-link/skip-link';
import { ThemeToggle } from '../../../layout/theme-toggle/theme-toggle';
import { Icon } from '../../../shared/ui/icon/icon';
import { Requires } from '../ui/requires';
import { ADMIN_SECTIONS, type AdminNavItem, visibleNav } from './admin-nav';
import { AdminShellData } from './admin-shell.data';
import { CommandPalette } from './command-palette';

/** The deepest route's `data.title` — the phone top bar's page name (a span, never a heading). */
export function routeTitle(root: ActivatedRouteSnapshot | null): string {
  let r = root;
  let title = '';
  while (r) {
    const t = r.data?.['title'];
    if (typeof t === 'string') title = t;
    r = r.firstChild;
  }
  return title;
}

/** The nav item a URL belongs to: the longest path (its own or a sub-item's) the URL starts with. */
export function activeNavKey(url: string, items: readonly AdminNavItem[]): string | null {
  const path = url.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/admin';
  let best: { key: string; len: number } | null = null;
  for (const i of items)
    for (const p of [i.path, ...(i.children ?? []).map((c) => c.path)]) {
      const hit = p === '/admin' ? path === '/admin' : path === p || path.startsWith(`${p}/`);
      if (hit && (!best || p.length > best.len)) best = { key: i.key, len: p.length };
    }
  return best?.key ?? null;
}

/**
 * The staff admin shell (docs/admin-redesign/02 §2–3): a dark top bar (brand, Ctrl/⌘ K search, notifications,
 * language, theme, account menu), the side navigation filtered by `can()` (a 72px icon rail ≤ 1100px), and on phones
 * (≤ 640px) a bottom tab bar with the More page (`/admin/menu`). Outside the storefront layout.
 */
@Component({
  selector: 'ta-admin-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SkipLink,
    LangSwitch,
    ThemeToggle,
    Icon,
    Requires,
    CommandPalette,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:click)': 'onDocClick($event)',
  },
})
export class AdminShell {
  protected readonly auth = inject(StaffAuth);
  protected readonly counts = inject(AdminShellData);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly sections = computed(() => visibleNav((p) => this.auth.can(p), ADMIN_SECTIONS));
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly initial = computed(() => (this.auth.staff()?.name ?? '').trim().charAt(0));
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly title = computed(() => {
    this.url();
    return routeTitle(this.router.routerState.snapshot.root);
  });
  protected readonly activeKey = computed(() =>
    activeNavKey(
      this.url(),
      this.sections().flatMap((s) => s.items),
    ),
  );
  protected readonly canCreate = computed(() => this.auth.can('staff:catalogue'));

  protected readonly paletteOpen = signal(false);
  protected readonly bellOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly exactChild = {
    paths: 'exact',
    queryParams: 'exact',
    fragment: 'ignored',
    matrixParams: 'ignored',
  } as const;

  constructor() {
    // Roles may have changed since the session started (an admin edited them): read the profile once per visit.
    void this.auth.refreshMe();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.bellOpen.set(false);
        this.accountOpen.set(false);
        this.counts.refresh();
      });
  }

  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.paletteOpen.set(true);
    } else if (e.key === 'Escape' && (this.bellOpen() || this.accountOpen())) {
      const which = this.bellOpen() ? 'adm-bell' : 'adm-account';
      this.bellOpen.set(false);
      this.accountOpen.set(false);
      this.host.nativeElement.querySelector<HTMLElement>(`#${which}`)?.focus();
    }
  }

  protected onDocClick(e: MouseEvent): void {
    const t = e.target as Node | null;
    const inside = (sel: string) =>
      !!t && !!this.host.nativeElement.querySelector(sel)?.contains(t);
    if (this.bellOpen() && !inside('.bell')) this.bellOpen.set(false);
    if (this.accountOpen() && !inside('.account')) this.accountOpen.set(false);
  }

  protected toggle(which: 'bell' | 'account'): void {
    const bell = which === 'bell' && !this.bellOpen();
    const account = which === 'account' && !this.accountOpen();
    this.bellOpen.set(bell);
    this.accountOpen.set(account);
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/admin/login');
    }
  }
}
