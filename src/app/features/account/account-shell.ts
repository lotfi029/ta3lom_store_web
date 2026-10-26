import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StoreAuth } from '../../core/auth/store-auth';
import { normalizeSaudiMobile } from '../../core/i18n/western-digits';
import { AccountData } from './account.data';

/**
 * `/account` (W-M4): a side menu (name, mobile, donation count) and the tab — My donations, Profile. The tabs are links
 * to child routes (`aria-current="page"` on the active one); below 960 px the menu becomes a scrolling row. The shell
 * owns the page `<h1>`; each tab starts at `<h2>`.
 */
@Component({
  selector: 'ta-account-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  providers: [AccountData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-shell.html',
  styleUrl: './account-shell.css',
})
export class AccountShell {
  private readonly auth = inject(StoreAuth);
  protected readonly data = inject(AccountData);

  protected readonly name = computed(
    () => this.auth.customer()?.fullName?.trim() || $localize`:@@store.layout.donor:متبرع`,
  );
  protected readonly initial = computed(() => [...this.name()][0] ?? '');
  protected readonly mobile = computed(() => {
    const m = this.auth.customer()?.mobile ?? '';
    return normalizeSaudiMobile(m) ?? m;
  });
}
