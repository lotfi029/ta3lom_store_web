import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AdminProductRow } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { CatalogAdminData, PRODUCTS_PAGE_SIZE, type ProductFilter } from './catalog-admin.data';
import { productStatus, productType } from './labels';

/** Products (#54, FR-S72): courses and books (r4), filtered by type, status, category and text. */
@Component({
  selector: 'ta-admin-products',
  imports: [RouterLink, Money, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.page.html',
  styleUrls: ['../admin-common.css'],
})
export class ProductsPage {
  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.products));
  /** r4: the pre-r4 API may still list (archived) cause products; they are never shown. */
  protected readonly items = computed(() =>
    (this.page()?.items ?? []).filter((p) => p.type === 'course' || p.type === 'book'),
  );
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PRODUCTS_PAGE_SIZE)),
  );
  protected readonly categories = computed(() => valueOf(this.data.categories) ?? []);
  protected readonly draft = signal<Omit<ProductFilter, 'page'>>({ ...this.data.filter() });
  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly status = productStatus;
  protected readonly type = productType;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-products:المنتجات`,
      description: '',
      path: '/admin/products',
      noindex: true,
    });
    this.data.products.reload();
  }

  protected set(field: keyof Omit<ProductFilter, 'page'>, event: Event): void {
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

  protected categoryName(id: string): string {
    const c = this.categories().find((x) => x.id === id);
    return c ? this.i18n.pick(c.nameAr, c.nameEn) : id;
  }

  protected track(p: AdminProductRow): string {
    return p.id;
  }
}
