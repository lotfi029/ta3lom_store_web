import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { ProjectDetail, SlugRedirect } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { valueOf } from '../../../core/http/resource-value';

/** `GET /v1/catalog/projects/{slug}` answers either the project or `{ redirectTo }` for an old slug (D-08). */
export const isRedirect = (v: ProjectDetail | SlugRedirect | undefined): v is SlugRedirect =>
  !!v && 'redirectTo' in v && typeof v.redirectTo === 'string';

/**
 * One project's detail (contract 15 §2.1), for the project page `/p/:slug` only — listing cards carry their options
 * themselves (`ProjectCard.options`, API-9). Read during prerender too (transfer state), so the prerendered page already
 * shows its options; refreshed after hydration.
 */
@Injectable()
export class ProjectData {
  private readonly api = inject(STORE_API_URL);
  readonly slug = signal<string | null>(null);
  readonly resource = httpResource<ProjectDetail | SlugRedirect>(() => {
    const s = this.slug();
    return s ? `${this.api}/catalog/projects/${encodeURIComponent(s)}` : undefined;
  });
  private readonly value = computed(() => valueOf(this.resource));
  readonly detail = computed(() => {
    const v = this.value();
    return v && !isRedirect(v) ? v : null;
  });
  readonly redirectTo = computed(() => {
    const v = this.value();
    return isRedirect(v) ? v.redirectTo : null;
  });
}
