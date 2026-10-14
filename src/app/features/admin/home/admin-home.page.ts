import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { roleLabel } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { ADMIN_NAV } from '../shell/admin-nav';

/** `/admin`: the signed-in staff user's roles and the screens open to them. */
@Component({
  selector: 'ta-admin-home',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ahead">
      <div>
        <h1 i18n="@@store.admin.home-title">لوحة إدارة المتجر</h1>
        <p><span i18n="@@store.admin.your-roles">أدوارك:</span> {{ roles() }}</p>
      </div>
    </div>
    <ul class="tiles">
      @for (item of items(); track item.path) {
        <li>
          <a class="panel" [routerLink]="item.path"
            ><ta-icon [name]="item.icon" [size]="22" /><span>{{ item.label() }}</span></a
          >
        </li>
      }
    </ul>
  `,
  styleUrls: ['../admin-common.css'],
  styles: `
    .tiles {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
    }
    .tiles a {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      color: var(--c-text);
      text-decoration: none;
      font-weight: 500;
    }
    .tiles ta-icon {
      color: var(--c-accent-strong);
    }
  `,
})
export class AdminHomePage {
  private readonly auth = inject(StaffAuth);
  private readonly seo = inject(SeoService);
  protected readonly roles = computed(() => this.auth.roles().map(roleLabel).join('، '));
  protected readonly items = computed(() =>
    ADMIN_NAV.filter((i) => i.path !== '/admin' && this.auth.can(i.policy)),
  );

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.home-title:لوحة إدارة المتجر`,
      description: '',
      path: '/admin',
      noindex: true,
    });
  }
}
