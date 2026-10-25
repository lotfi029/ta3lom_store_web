import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AuditPage,
  CreateStaff,
  CreateStaffResult,
  MessageTemplate,
  OneTimePassword,
  Setting,
  StaffUser,
  TemplateTest,
  TemplateInput,
  TemplateTestResult,
  UpdateStaff,
} from '../../core/api/api.types';
import { STORE_API_URL } from '../../core/api/store-api-url';
import { StaffAuth } from '../../core/auth/staff-auth';

export interface AuditFilter {
  actor: string;
  entity: string;
  action: string;
  entityId: string;
  page: number;
}

export const AUDIT_PAGE_SIZE = 50;

/**
 * Admin platform data (contract 15 §2.8–§2.9): staff users, settings, message templates, audit log. Every read waits
 * for the staff session and the screen's policy (settings and audit: `staff:admin`; templates: `staff:templates`); the
 * API enforces the same table.
 */
@Injectable({ providedIn: 'root' })
export class PlatformData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StaffAuth);
  private readonly isAdmin = computed(() => this.auth.isSignedIn() && this.auth.can('staff:admin'));
  private readonly canTemplates = computed(
    () => this.auth.isSignedIn() && this.auth.can('staff:templates'),
  );

  readonly staff = httpResource<StaffUser[]>(() =>
    this.isAdmin() ? `${this.api}/admin/staff` : undefined,
  );
  readonly settings = httpResource<Setting[]>(() =>
    this.isAdmin() ? `${this.api}/admin/settings` : undefined,
  );
  readonly templates = httpResource<MessageTemplate[]>(() =>
    this.canTemplates() ? `${this.api}/admin/templates` : undefined,
  );

  readonly auditFilter = signal<AuditFilter>({
    actor: '',
    entity: '',
    action: '',
    entityId: '',
    page: 1,
  });
  readonly audit = httpResource<AuditPage>(() => {
    if (!this.isAdmin()) return undefined;
    const f = this.auditFilter();
    const params: Record<string, string | number> = { page: f.page, pageSize: AUDIT_PAGE_SIZE };
    for (const k of ['actor', 'entity', 'action', 'entityId'] as const)
      if (f[k].trim()) params[k] = f[k].trim();
    return { url: `${this.api}/admin/audit`, params };
  });

  async createStaff(body: CreateStaff): Promise<CreateStaffResult> {
    const r = await firstValueFrom(
      this.http.post<CreateStaffResult>(`${this.api}/admin/staff`, body),
    );
    this.staff.reload();
    return r;
  }

  async updateStaff(id: string, body: UpdateStaff): Promise<StaffUser> {
    const r = await firstValueFrom(this.http.put<StaffUser>(`${this.api}/admin/staff/${id}`, body));
    this.staff.reload();
    return r;
  }

  resetPassword(id: string): Promise<OneTimePassword> {
    return firstValueFrom(
      this.http.post<OneTimePassword>(`${this.api}/admin/staff/${id}/reset-password`, null),
    );
  }

  async resetTotp(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/admin/staff/${id}/reset-totp`, null));
    this.staff.reload();
  }

  async unlock(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/admin/staff/${id}/unlock`, null));
    this.staff.reload();
  }

  async saveSetting(key: string, value: unknown): Promise<Setting> {
    const r = await firstValueFrom(
      this.http.put<Setting>(`${this.api}/admin/settings/${encodeURIComponent(key)}`, { value }),
    );
    this.settings.reload();
    return r;
  }

  async saveTemplate(
    t: Pick<MessageTemplate, 'key' | 'channel' | 'locale'>,
    body: TemplateInput,
  ): Promise<MessageTemplate> {
    const r = await firstValueFrom(this.http.put<MessageTemplate>(this.templateUrl(t), body));
    this.templates.reload();
    return r;
  }

  /** `POST /admin/templates/test`: renders the text with sample values and sends it (5 per hour per member). */
  testTemplate(body: TemplateTest): Promise<TemplateTestResult> {
    return firstValueFrom(
      this.http.post<TemplateTestResult>(`${this.api}/admin/templates/test`, body),
    );
  }

  private templateUrl(t: Pick<MessageTemplate, 'key' | 'channel' | 'locale'>): string {
    return `${this.api}/admin/templates/${encodeURIComponent(t.key)}/${encodeURIComponent(t.channel)}/${encodeURIComponent(t.locale)}`;
  }
}
