import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import type { AdminCategory, CategoryInput, MediaAsset } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { type HasUnsavedChanges, warnBeforeUnload } from '../../../core/guards/guards';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { westernDigits } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { ReorderList } from '../../../shared/ui/reorder-list/reorder-list';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { ConflictDialog } from '../ui/conflict-dialog';
import { Requires } from '../ui/requires';
import { CatalogAdminData } from './catalog-admin.data';
import { MediaPicker } from './media-picker';

/** Category slugs as the API validates them (contract 15 §2.7). */
export const CATEGORY_SLUG = /^[a-z0-9-]{2,60}$/;
/** `sort` 0–10000 (contract 15 §2.7). */
export const SORT_RE = /^\d{1,5}$/;

export interface CategoryModel {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  imageAssetId: string | null;
  imageUrl: string | null;
  imageAlt: string;
  acceptsGeneralGifts: boolean;
  isActive: boolean;
  sort: string;
}

export function categoryModel(c: AdminCategory | null, nextSort: number): CategoryModel {
  return {
    slug: c?.slug ?? '',
    nameAr: c?.nameAr ?? '',
    nameEn: c?.nameEn ?? '',
    descriptionAr: c?.descriptionAr ?? '',
    descriptionEn: c?.descriptionEn ?? '',
    imageAssetId: c?.imageAssetId ?? null,
    imageUrl: c?.imageUrl ?? null,
    imageAlt: '',
    acceptsGeneralGifts: c?.acceptsGeneralGifts ?? false,
    isActive: c?.isActive ?? true,
    sort: String(c ? toInt(c.sort) : nextSort),
  };
}

/** The form → `CategoryInput` (trimmed; blank optional texts → null; `version` only on update). */
export function categoryInput(m: CategoryModel, version: number | null): CategoryInput {
  const opt = (s: string) => s.trim() || null;
  return {
    slug: m.slug.trim(),
    nameAr: m.nameAr.trim(),
    nameEn: opt(m.nameEn),
    descriptionAr: opt(m.descriptionAr),
    descriptionEn: opt(m.descriptionEn),
    imageAssetId: m.imageAssetId,
    acceptsGeneralGifts: m.acceptsGeneralGifts,
    isActive: m.isActive,
    sort: Number.parseInt(westernDigits(m.sort).trim(), 10),
    version,
  };
}

/**
 * Categories (contract 15 §2.7): the storefront chips and quick-donate targets. Drag or up/down to reorder
 * (`PUT /admin/categories/order`); edit in a dialog (bilingual name and description, image, general gifts, active,
 * sort). Saves send `version`; a 409 `concurrency.conflict` opens the conflict dialog. Deactivated, never deleted.
 */
@Component({
  selector: 'ta-admin-categories',
  imports: [
    FormField,
    Dialog,
    ResourceState,
    StatusPill,
    Requires,
    ReorderList,
    MediaPicker,
    ConflictDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories.page.html',
  styleUrls: ['../admin-common.css', './categories.page.css'],
})
export class CategoriesPage implements HasUnsavedChanges {
  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  /** The API's order (`sort`, then `nameAr`). */
  protected readonly list = computed(() => valueOf(this.data.categories) ?? []);
  protected readonly editing = signal<AdminCategory | 'new' | null>(null);
  protected readonly open = signal(false);
  protected readonly pickerOpen = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly reordering = signal(false);
  private readonly initial = signal<string>('');
  protected readonly model = signal<CategoryModel>(categoryModel(null, 0));
  protected readonly f = form(this.model, (p) => {
    required(p.nameAr, { message: $localize`:@@store.admin.name-required:أدخل الاسم.` });
    maxLength(p.nameAr, 120, { message: $localize`:@@store.admin.max-120:120 حرفًا على الأكثر.` });
    maxLength(p.nameEn, 120, { message: $localize`:@@store.admin.max-120:120 حرفًا على الأكثر.` });
    maxLength(p.descriptionAr, 2000, {
      message: $localize`:@@store.admin.max-2000:2000 حرف على الأكثر.`,
    });
    maxLength(p.descriptionEn, 2000, {
      message: $localize`:@@store.admin.max-2000:2000 حرف على الأكثر.`,
    });
    validate(p.slug, ({ value }) =>
      CATEGORY_SLUG.test(value().trim())
        ? undefined
        : {
            kind: 'slug',
            message: $localize`:@@store.admin.slug-invalid:أحرف إنجليزية صغيرة وأرقام وشرطات فقط.`,
          },
    );
    validate(p.sort, ({ value }) => sortError(value()));
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dirty = computed(
    () => this.open() && JSON.stringify(this.model()) !== this.initial(),
  );

  constructor() {
    warnBeforeUnload(() => this.hasUnsavedChanges());
    this.seo.set({
      title: $localize`:@@store.admin.nav-categories:التصنيفات`,
      description: '',
      path: '/admin/categories',
      noindex: true,
    });
    this.data.categories.reload();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  protected startCreate(): void {
    const last = this.list().at(-1);
    this.begin('new', categoryModel(null, last ? toInt(last.sort) + 10 : 0));
  }

  protected startEdit(c: AdminCategory): void {
    this.begin(c, categoryModel(c, 0));
  }

  private begin(target: AdminCategory | 'new', m: CategoryModel): void {
    this.model.set(m);
    this.initial.set(JSON.stringify(m));
    this.error.set(null);
    this.editing.set(target);
    this.open.set(true);
  }

  protected setFlag(key: 'isActive' | 'acceptsGeneralGifts', e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.model.update((m) => ({ ...m, [key]: on }));
  }

  protected picked(a: MediaAsset): void {
    this.model.update((m) => ({
      ...m,
      imageAssetId: a.id,
      imageUrl: a.url,
      imageAlt: this.i18n.pick(a.altAr ?? '', a.altEn),
    }));
  }

  protected clearImage(): void {
    this.model.update((m) => ({ ...m, imageAssetId: null, imageUrl: null, imageAlt: '' }));
  }

  protected async reorder(ids: string[]): Promise<void> {
    if (this.reordering()) return;
    this.reordering.set(true);
    try {
      await this.data.reorderCategories(ids);
    } catch (err) {
      this.toast.show(problemMessage(toProblem(err)), 'error');
      this.data.categories.reload();
    } finally {
      this.reordering.set(false);
    }
  }

  protected async save(e: Event): Promise<void> {
    e.preventDefault();
    this.f().markAsTouched();
    const target = this.editing();
    if (this.f().invalid() || this.busy() || !target) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.data.saveCategory(
        target === 'new' ? null : target.id,
        categoryInput(this.model(), target === 'new' ? null : toInt(target.version)),
      );
      this.open.set(false);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      const p = toProblem(err);
      if (p.code === 'concurrency.conflict') this.conflictOpen.set(true);
      else this.error.set(problemMessage(p));
    } finally {
      this.busy.set(false);
    }
  }

  /** Conflict → close the form and reload the list; the latest version is then edited again. */
  protected reloadLatest(): void {
    this.open.set(false);
    this.data.categories.reload();
  }
}

/** `sort` field: a whole number 0–10000 (Arabic-Indic digits accepted). */
export function sortError(value: string): { kind: string; message: string } | undefined {
  const v = westernDigits(value).trim();
  return SORT_RE.test(v) && Number.parseInt(v, 10) <= 10000
    ? undefined
    : {
        kind: 'sort',
        message: $localize`:@@store.admin.sort-invalid:أدخل عددًا صحيحًا من 0 إلى 10000.`,
      };
}
