import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toInt } from '../../../core/api/api.types';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { projectStatus } from '../../../shared/ui/status-pill/status-labels';
import { Requires } from '../ui/requires';
import { CatalogAdminData, PROJECTS_PAGE_SIZE, type ProjectFilter } from './catalog-admin.data';

/** Projects (contract 15 §2.7): drafts, published and archived, filtered by status, category (id) and text. */
@Component({
  selector: 'ta-admin-projects',
  imports: [RouterLink, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects.page.html',
  styleUrls: ['../admin-common.css'],
})
export class ProjectsPage {
  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.projects));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PROJECTS_PAGE_SIZE)),
  );
  protected readonly categories = computed(() => valueOf(this.data.categories) ?? []);
  protected readonly draft = signal<Omit<ProjectFilter, 'page'>>({ ...this.data.filter() });
  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly status = projectStatus;
  protected readonly toInt = toInt;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-projects:المشاريع`,
      description: '',
      path: '/admin/projects',
      noindex: true,
    });
    this.data.projects.reload();
    this.data.categories.reload();
  }

  protected set(field: keyof Omit<ProjectFilter, 'page'>, event: Event): void {
    const v = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.update((d) => ({ ...d, [field]: v }));
  }

  protected apply(event: Event): void {
    event.preventDefault();
    this.data.filter.set({ ...this.draft(), page: 1 });
  }

  protected go(page: number): void {
    this.data.filter.update((f) => ({ ...f, page: Math.min(this.pages(), Math.max(1, page)) }));
  }
}
