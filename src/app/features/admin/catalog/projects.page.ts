import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type ProjectStatus, toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { projectStatus } from '../../../shared/ui/status-pill/status-labels';
import { AdminBadge, badgeKind } from '../ui/badge';
import { BulkBar } from '../ui/index-page/bulk-bar';
import { type BulkResult, runBulk } from '../ui/index-page/bulk-runner';
import { type FilterPill, FilterPills } from '../ui/index-page/filter-pills';
import { PageSelection } from '../ui/index-page/selection';
import { type SummaryCard, SummaryCards } from '../ui/index-page/summary-cards';
import { type ViewTab, ViewTabs } from '../ui/index-page/view-tabs';
import { Requires } from '../ui/requires';
import { AdminViewport } from '../ui/viewport';
import { CatalogAdminData, PROJECTS_PAGE_SIZE, type ProjectFilter } from './catalog-admin.data';
import { missingLabel } from './project-models';

export type BulkAction = 'publish' | 'archive';

/** One line of the bulk result dialog: the project's title and why it failed (the API's `missing[]` labels first). */
export function bulkFailure(r: BulkResult, title: string): string {
  const m = r.problem?.extra['missing'];
  const why =
    Array.isArray(m) && m.length
      ? m
          .filter((x): x is string => typeof x === 'string')
          .map(missingLabel)
          .join('، ')
      : r.problem
        ? problemMessage(r.problem)
        : '';
  return `${title}: ${why}`;
}

/**
 * Projects index (docs/admin-redesign/02 §2, mockups D/T/P-Projects; contract 15 §2.7): status counts, status views,
 * search and category filters, page-scoped selection with bulk publish / archive (one call per project, 2 at a time,
 * no retries), a table on wide screens and a card list on phones.
 */
@Component({
  selector: 'ta-admin-projects',
  imports: [
    RouterLink,
    ResourceState,
    Requires,
    AdminBadge,
    SummaryCards,
    ViewTabs,
    FilterPills,
    BulkBar,
    Dialog,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects.page.html',
  styleUrls: ['../admin-common.css', './projects.page.css'],
})
export class ProjectsPage {
  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  protected readonly viewport = inject(AdminViewport);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.projects));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly ids = computed(() => this.items().map((p) => p.id));
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PROJECTS_PAGE_SIZE)),
  );
  protected readonly categories = computed(() => valueOf(this.data.categories) ?? []);
  protected readonly q = signal(this.data.filter().q);
  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly selection = new PageSelection();
  protected readonly status = projectStatus;
  protected readonly kind = badgeKind;
  protected readonly toInt = toInt;

  private count(r: {
    hasValue(): boolean;
    value(): { total: number | string } | undefined;
  }): number | null {
    const v = valueOf(r);
    return v ? toInt(v.total) : null;
  }

  protected readonly cards = computed<SummaryCard[]>(() => [
    {
      key: 'published',
      label: $localize`:@@store.admin.count-published:منشورة`,
      value: this.count(this.data.counts.published),
    },
    {
      key: 'draft',
      label: $localize`:@@store.admin.count-drafts:مسودات`,
      value: this.count(this.data.counts.draft),
    },
    {
      key: 'archived',
      label: $localize`:@@store.admin.count-archived:مؤرشفة`,
      value: this.count(this.data.counts.archived),
    },
  ]);

  protected readonly tabs: readonly ViewTab[] = [
    { key: '', label: $localize`:@@store.admin.all:الكل` },
    { key: 'published', label: $localize`:@@store.admin.status-published:منشور` },
    { key: 'draft', label: $localize`:@@store.admin.status-draft:مسودة` },
    { key: 'archived', label: $localize`:@@store.admin.status-archived:مؤرشف` },
  ];

  protected readonly pills = computed<FilterPill[]>(() => {
    const f = this.data.filter();
    const out: FilterPill[] = [];
    const cat = this.categories().find((c) => c.id === f.category);
    if (cat)
      out.push({
        key: 'category',
        label: $localize`:@@store.admin.pill-category:التصنيف: ${this.i18n.pick(cat.nameAr, cat.nameEn)}:name:`,
      });
    if (f.q.trim())
      out.push({ key: 'q', label: $localize`:@@store.admin.pill-search:بحث: ${f.q.trim()}:q:` });
    return out;
  });

  // Bulk
  protected readonly running = signal<BulkAction | null>(null);
  protected readonly resultOpen = signal(false);
  protected readonly result = signal<{ action: BulkAction; ok: number; failures: string[] } | null>(
    null,
  );

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-projects:المشاريع`,
      description: '',
      path: '/admin/projects',
      noindex: true,
    });
    this.data.reloadProjects();
    this.data.categories.reload();
  }

  private update(patch: Partial<ProjectFilter>): void {
    this.selection.reset();
    this.data.filter.update((f) => ({ ...f, ...patch, page: 1 }));
  }

  protected setStatus(s: string): void {
    this.update({ status: s as '' | ProjectStatus });
  }

  protected setCategory(e: Event): void {
    this.update({ category: (e.target as HTMLSelectElement).value });
  }

  protected search(e: Event): void {
    e.preventDefault();
    this.update({ q: this.q() });
  }

  protected removePill(key: string): void {
    if (key === 'q') this.q.set('');
    this.update(key === 'category' ? { category: '' } : { q: '' });
  }

  protected go(page: number): void {
    this.selection.reset();
    this.data.filter.update((f) => ({ ...f, page: Math.min(this.pages(), Math.max(1, page)) }));
  }

  protected rowLabel(title: string): string {
    return $localize`:@@store.admin.select-row:تحديد ${title}:title:`;
  }

  protected async bulk(action: BulkAction): Promise<void> {
    const ids = this.selection.selected();
    if (!ids.length || this.running()) return;
    const titles = new Map(this.items().map((p) => [p.id, p.titleAr]));
    this.running.set(action);
    try {
      const results = await runBulk(ids, (id) => this.data.transition(id, action, false));
      this.result.set({
        action,
        ok: results.filter((r) => r.ok).length,
        failures: results.filter((r) => !r.ok).map((r) => bulkFailure(r, titles.get(r.id) ?? r.id)),
      });
      this.resultOpen.set(true);
    } finally {
      this.running.set(null);
      this.selection.reset();
      this.data.reloadProjects();
    }
  }

  protected resultTitle(r: { action: BulkAction; ok: number }, total: number): string {
    return r.action === 'publish'
      ? $localize`:@@store.admin.bulk-published:نُشر ${r.ok}:ok: من ${total}:total:`
      : $localize`:@@store.admin.bulk-archived:أُرشف ${r.ok}:ok: من ${total}:total:`;
  }
}
