import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import type { AdminCategory } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { westernDigits } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { CatalogAdminData } from './catalog-admin.data';

/** Category slugs as the API validates them (11 §9.5). */
export const CATEGORY_SLUG = /^[a-z0-9-]{2,60}$/;

interface CategoryModel {
  slug: string;
  nameAr: string;
  nameEn: string;
  sort: string;
  isActive: boolean;
}

/** Categories (#72–#74): the catalogue chips' source. Deactivated, never deleted. */
@Component({
  selector: 'ta-admin-categories',
  imports: [FormField, Dialog, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories.page.html',
  styleUrls: ['../admin-common.css'],
})
export class CategoriesPage {
  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly list = computed(() =>
    [...(valueOf(this.data.categories) ?? [])].sort((a, b) => toInt(a.sort) - toInt(b.sort)),
  );
  protected readonly editing = signal<AdminCategory | 'new' | null>(null);
  protected readonly open = signal(false);
  protected readonly model = signal<CategoryModel>({
    slug: '',
    nameAr: '',
    nameEn: '',
    sort: '0',
    isActive: true,
  });
  protected readonly f = form(this.model, (p) => {
    required(p.nameAr, { message: $localize`:@@store.admin.name-required:أدخل الاسم.` });
    validate(p.slug, ({ value }) =>
      CATEGORY_SLUG.test(value().trim())
        ? undefined
        : {
            kind: 'slug',
            message: $localize`:@@store.admin.slug-invalid:أحرف إنجليزية صغيرة وأرقام وشرطات فقط.`,
          },
    );
    validate(p.sort, ({ value }) =>
      /^\d+$/.test(westernDigits(value()).trim())
        ? undefined
        : { kind: 'sort', message: $localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.` },
    );
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-categories:التصنيفات`,
      description: '',
      path: '/admin/categories',
      noindex: true,
    });
    this.data.categories.reload();
  }

  protected startCreate(): void {
    this.model.set({
      slug: '',
      nameAr: '',
      nameEn: '',
      sort: String(this.list().length),
      isActive: true,
    });
    this.error.set(null);
    this.editing.set('new');
    this.open.set(true);
  }

  protected startEdit(c: AdminCategory): void {
    this.model.set({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn ?? '',
      sort: String(toInt(c.sort)),
      isActive: c.isActive,
    });
    this.error.set(null);
    this.editing.set(c);
    this.open.set(true);
  }

  protected setActive(e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.model.update((m) => ({ ...m, isActive: on }));
  }

  protected async save(e: Event): Promise<void> {
    e.preventDefault();
    this.f().markAsTouched();
    const target = this.editing();
    if (this.f().invalid() || this.busy() || !target) return;
    this.busy.set(true);
    this.error.set(null);
    const m = this.model();
    try {
      await this.data.saveCategory(target === 'new' ? null : target.id, {
        slug: m.slug.trim(),
        nameAr: m.nameAr.trim(),
        nameEn: m.nameEn.trim() || null,
        sort: Number.parseInt(westernDigits(m.sort).trim(), 10),
        isActive: m.isActive,
      });
      this.open.set(false);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
