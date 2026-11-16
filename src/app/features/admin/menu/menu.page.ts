import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { roleLabel } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { SeoService } from '../../../core/seo/seo.service';
import { LangSwitch } from '../../../layout/lang-switch/lang-switch';
import { ThemeToggle } from '../../../layout/theme-toggle/theme-toggle';
import { Icon } from '../../../shared/ui/icon/icon';
import { ADMIN_SECTIONS, visibleNav } from '../shell/admin-nav';
import { AdminShellData } from '../shell/admin-shell.data';

/** Wider than a phone, the side nav is on screen: the More page is not needed there (03 §3). */
export const MENU_MAX_WIDTH = 640;

/**
 * `/admin/menu` — the phone "More" page (docs/admin-redesign/02 §3, mockup P-Menu): the account card, the payments
 * notice, every section the user may read, language, theme, password and sign out. Wider screens go to `/admin`.
 */
@Component({
  selector: 'ta-admin-menu',
  imports: [RouterLink, Icon, LangSwitch, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu.page.html',
  styleUrls: ['../admin-common.css', './menu.page.css'],
})
export class AdminMenuPage {
  protected readonly auth = inject(StaffAuth);
  protected readonly counts = inject(AdminShellData);
  private readonly router = inject(Router);

  protected readonly sections = computed(() => visibleNav((p) => this.auth.can(p), ADMIN_SECTIONS));
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly initial = computed(() => (this.auth.staff()?.name ?? '').trim().charAt(0));

  constructor() {
    inject(SeoService).set({
      title: $localize`:@@store.admin.more:المزيد`,
      description: '',
      path: '/admin/menu',
      noindex: true,
    });
    if (
      isPlatformBrowser(inject(PLATFORM_ID)) &&
      window.matchMedia(`(width > ${MENU_MAX_WIDTH}px)`).matches
    )
      void this.router.navigateByUrl('/admin', { replaceUrl: true });
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/admin/login');
    }
  }
}
