import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { AuditEntry } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { AUDIT_PAGE_SIZE, type AuditFilter, PlatformData } from '../platform.data';

/** The audit log (#133, FR-S78): every staff write, filtered by actor, entity, action and Riyadh dates. `staff:admin`. */
@Component({
  selector: 'ta-admin-audit',
  imports: [ResourceState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit.page.html',
  styleUrls: ['../admin-common.css', './audit.page.css'],
})
export class AuditPage {
  protected readonly data = inject(PlatformData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.audit));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / AUDIT_PAGE_SIZE)),
  );
  protected readonly draft = signal<Omit<AuditFilter, 'page'>>({ ...this.data.auditFilter() });
  protected readonly open = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-audit:سجل التدقيق`,
      description: '',
      path: '/admin/audit',
      noindex: true,
    });
    this.data.audit.reload();
  }

  protected set(field: keyof Omit<AuditFilter, 'page'>, event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: v }));
  }

  protected apply(event: Event): void {
    event.preventDefault();
    this.data.auditFilter.set({ ...this.draft(), page: 1 });
  }

  protected clear(): void {
    const empty = { actor: '', entity: '', action: '', from: '', to: '' };
    this.draft.set(empty);
    this.data.auditFilter.set({ ...empty, page: 1 });
  }

  protected go(page: number): void {
    this.data.auditFilter.update((f) => ({
      ...f,
      page: Math.min(this.pages(), Math.max(1, page)),
    }));
  }

  protected diff(e: AuditEntry): string {
    return e.diff === null || e.diff === undefined ? '' : JSON.stringify(e.diff, null, 2);
  }

  protected toggle(e: AuditEntry): void {
    const k = String(e.id);
    this.open.set(this.open() === k ? null : k);
  }

  protected key(e: AuditEntry): string {
    return String(e.id);
  }
}
