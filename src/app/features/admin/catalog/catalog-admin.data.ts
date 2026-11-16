import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminCategory,
  AdminProject,
  AdminProjectPage,
  CategoryInput,
  MediaAltInput,
  MediaAsset,
  MediaPage,
  ProjectDetail,
  ProjectInput,
  ProjectOptionsInput,
  ProjectStatus,
} from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';

export interface ProjectFilter {
  status: '' | ProjectStatus;
  /** Category id (GUID) — the admin list filters by id, not slug (contract 15 §2.7). */
  category: string;
  q: string;
  page: number;
}

export const PROJECTS_PAGE_SIZE = 20;
export const MEDIA_PAGE_SIZE = 24;

/**
 * Admin catalogue (contract 15 §2.7): categories (incl. order), projects (fields, options, publish/archive/preview)
 * and the media library (images). Reads need `staff:read`; writes `staff:catalogue` (the screens disable them and the
 * API enforces the same table).
 */
@Injectable({ providedIn: 'root' })
export class CatalogAdminData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StaffAuth);
  private readonly on = computed(() => this.auth.isSignedIn() && this.auth.can('staff:read'));

  readonly filter = signal<ProjectFilter>({ status: '', category: '', q: '', page: 1 });
  readonly projects = httpResource<AdminProjectPage>(() => {
    if (!this.on()) return undefined;
    const f = this.filter();
    const params: Record<string, string | number> = { page: f.page, pageSize: PROJECTS_PAGE_SIZE };
    if (f.status) params['status'] = f.status;
    if (f.category) params['category'] = f.category;
    if (f.q.trim()) params['q'] = f.q.trim();
    return { url: `${this.api}/admin/projects`, params };
  });

  /**
   * Status counts for the projects index (03 §4): one `pageSize=1` request per status, reading the paged `total`.
   * Keyed on category + search only, so paging never refetches them (review S10).
   */
  private readonly countBase = computed(
    () => {
      const f = this.filter();
      const params: Record<string, string | number> = { page: 1, pageSize: 1 };
      if (f.category) params['category'] = f.category;
      if (f.q.trim()) params['q'] = f.q.trim();
      return params;
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private countOf(status: ProjectStatus) {
    return httpResource<AdminProjectPage>(() =>
      this.on()
        ? { url: `${this.api}/admin/projects`, params: { ...this.countBase(), status } }
        : undefined,
    );
  }
  readonly counts = {
    published: this.countOf('published'),
    draft: this.countOf('draft'),
    archived: this.countOf('archived'),
  } as const;

  /** Drafts in the whole catalogue (dashboard tasks and readiness, W-A5): `pageSize=1`, the paged total. */
  readonly draftTotal = httpResource<AdminProjectPage>(() =>
    this.on()
      ? { url: `${this.api}/admin/projects`, params: { status: 'draft', page: 1, pageSize: 1 } }
      : undefined,
  );

  readonly categories = httpResource<AdminCategory[]>(() =>
    this.on() ? `${this.api}/admin/categories` : undefined,
  );

  readonly mediaPage = signal(1);
  readonly media = httpResource<MediaPage>(() =>
    this.on()
      ? {
          url: `${this.api}/admin/media`,
          params: { kind: 'image', page: this.mediaPage(), pageSize: MEDIA_PAGE_SIZE },
        }
      : undefined,
  );

  // Categories

  async saveCategory(id: string | null, body: CategoryInput): Promise<AdminCategory> {
    const c = id
      ? await firstValueFrom(
          this.http.put<AdminCategory>(`${this.api}/admin/categories/${id}`, body),
        )
      : await firstValueFrom(this.http.post<AdminCategory>(`${this.api}/admin/categories`, body));
    this.categories.reload();
    return c;
  }

  /** `PUT /admin/categories/order`: the full list, `sort` = position × 10 (gaps leave room for manual sorts). */
  async reorderCategories(ids: readonly string[]): Promise<AdminCategory[]> {
    const list = await firstValueFrom(
      this.http.put<AdminCategory[]>(`${this.api}/admin/categories/order`, {
        items: ids.map((id, i) => ({ id, sort: i * 10 })),
      }),
    );
    this.categories.set(list);
    return list;
  }

  // Projects

  project(id: string): Promise<AdminProject> {
    return firstValueFrom(this.http.get<AdminProject>(`${this.api}/admin/projects/${id}`));
  }

  async createProject(body: ProjectInput): Promise<AdminProject> {
    const p = await firstValueFrom(
      this.http.post<AdminProject>(`${this.api}/admin/projects`, body),
    );
    this.projects.reload();
    return p;
  }

  async saveProject(id: string, body: ProjectInput): Promise<AdminProject> {
    const p = await firstValueFrom(
      this.http.put<AdminProject>(`${this.api}/admin/projects/${id}`, body),
    );
    this.projects.reload();
    return p;
  }

  async saveOptions(id: string, body: ProjectOptionsInput): Promise<AdminProject> {
    const p = await firstValueFrom(
      this.http.put<AdminProject>(`${this.api}/admin/projects/${id}/options`, body),
    );
    this.projects.reload();
    return p;
  }

  /** `reload = false` lets the bulk runner reload the list once at the end (03 §13.9). */
  async transition(id: string, to: 'publish' | 'archive', reload = true): Promise<AdminProject> {
    const p = await firstValueFrom(
      this.http.post<AdminProject>(`${this.api}/admin/projects/${id}/${to}`, null),
    );
    if (reload) this.reloadProjects();
    return p;
  }

  /** The list and its status counts. */
  reloadProjects(): void {
    this.projects.reload();
    for (const c of Object.values(this.counts)) c.reload();
  }

  preview(id: string): Promise<ProjectDetail> {
    return firstValueFrom(this.http.get<ProjectDetail>(`${this.api}/admin/projects/${id}/preview`));
  }

  // Media (images only in R5)

  async upload(file: File, altAr: string, altEn: string): Promise<MediaAsset> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'image');
    form.append('altAr', altAr.trim());
    if (altEn.trim()) form.append('altEn', altEn.trim());
    const a = await firstValueFrom(this.http.post<MediaAsset>(`${this.api}/admin/media`, form));
    this.media.reload();
    return a;
  }

  async saveAlt(id: string, body: MediaAltInput): Promise<MediaAsset> {
    const a = await firstValueFrom(
      this.http.patch<MediaAsset>(`${this.api}/admin/media/${id}`, body),
    );
    this.media.reload();
    return a;
  }
}
