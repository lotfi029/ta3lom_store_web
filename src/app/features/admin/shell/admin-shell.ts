import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { roleLabel } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { LangSwitch } from '../../../layout/lang-switch/lang-switch';
import { SkipLink } from '../../../layout/skip-link/skip-link';
import { ThemeToggle } from '../../../layout/theme-toggle/theme-toggle';
import { Icon } from '../../../shared/ui/icon/icon';
import { ADMIN_NAV } from './admin-nav';

/**
 * The staff admin shell (plan W-08, 10 §16): top bar (store admin, staff name and roles, language, theme, sign out),
 * a side navigation filtered by `can()`, and the screen in `<main id="admin-main">`. Outside the storefront layout.
 */
@Component({
  selector: 'ta-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SkipLink, LangSwitch, ThemeToggle, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  protected readonly auth = inject(StaffAuth);
  private readonly router = inject(Router);

  protected readonly nav = computed(() => ADMIN_NAV.filter((i) => this.auth.can(i.policy)));
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly menuOpen = signal(false);

  protected async signOut(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/admin/login');
    }
  }
}
