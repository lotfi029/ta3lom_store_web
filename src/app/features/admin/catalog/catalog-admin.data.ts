import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminCategory,
  AdminProduct,
  AdminProductPage,
  BookDetailInput,
  BookFormatInput,
  CategoryInput,
  CourseDetailInput,
  CourseModuleInput,
  MediaAltInput,
  MediaAsset,
  MediaPage,
  ProductDetail,
  ProductInput,
  StockMovementRequest,
  StockRow,
} from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';

export interface ProductFilter {
  type: '' | 'course' | 'book';
  status: '' | 'draft' | 'published' | 'archived';
  category: string;
  q: string;
  page: number;
}

export const PRODUCTS_PAGE_SIZE = 20;
export const MEDIA_PAGE_SIZE = 24;

/**
 * Admin catalogue (#54–#62, #64–#66, #72–#80): products (courses and books only, r4), course and book details,
 * curriculum, formats, publish/archive/preview, categories, media, and print stock movements.
 */
@Injectable({ providedIn: 'root' })
export class CatalogAdminData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StaffAuth);
  private readonly on = computed(() => this.auth.isSignedIn());

  readonly filter = signal<ProductFilter>({ type: '', status: '', category: '', q: '', page: 1 });
  readonly products = httpResource<AdminProductPage>(() => {
    if (!this.on()) return undefined;
    const f = this.filter();
    const params: Record<string, string | number> = { page: f.page, pageSize: PRODUCTS_PAGE_SIZE };
    if (f.type) params['type'] = f.type;
    if (f.status) params['status'] = f.status;
    if (f.category) params['category'] = f.category;
    if (f.q.trim()) params['q'] = f.q.trim();
    return { url: `${this.api}/admin/products`, params };
  });
  readonly categories = httpResource<AdminCategory[]>(() =>
    this.on() ? `${this.api}/admin/categories` : undefined,
  );

  readonly mediaKind = signal<'' | 'image' | 'pdf' | 'book_file'>('image');
  readonly mediaPage = signal(1);
  readonly media = httpResource<MediaPage>(() => {
    if (!this.on()) return undefined;
    const params: Record<string, string | number> = {
      page: this.mediaPage(),
      pageSize: MEDIA_PAGE_SIZE,
    };
    if (this.mediaKind()) params['kind'] = this.mediaKind();
    return { url: `${this.api}/admin/media`, params };
  });

  product(id: string): Promise<AdminProduct> {
    return firstValueFrom(this.http.get<AdminProduct>(`${this.api}/admin/products/${id}`));
  }

  async createProduct(body: ProductInput): Promise<AdminProduct> {
    const p = await firstValueFrom(
      this.http.post<AdminProduct>(`${this.api}/admin/products`, body),
    );
    this.products.reload();
    return p;
  }

  saveProduct(id: string, body: ProductInput): Promise<AdminProduct> {
    return firstValueFrom(this.http.put<AdminProduct>(`${this.api}/admin/products/${id}`, body));
  }

  saveCourse(id: string, body: CourseDetailInput): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.put<AdminProduct>(`${this.api}/admin/products/${id}/course`, body),
    );
  }

  saveModules(id: string, body: CourseModuleInput[]): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.put<AdminProduct>(`${this.api}/admin/products/${id}/modules`, body),
    );
  }

  saveBook(id: string, body: BookDetailInput): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.put<AdminProduct>(`${this.api}/admin/products/${id}/book`, body),
    );
  }

  addFormat(id: string, body: BookFormatInput): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.api}/admin/products/${id}/formats`, body));
  }

  saveFormat(formatId: string, body: BookFormatInput): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.api}/admin/formats/${formatId}`, body));
  }

  async publish(id: string): Promise<AdminProduct> {
    const p = await firstValueFrom(
      this.http.post<AdminProduct>(`${this.api}/admin/products/${id}/publish`, null),
    );
    this.products.reload();
    return p;
  }

  async archive(id: string): Promise<AdminProduct> {
    const p = await firstValueFrom(
      this.http.post<AdminProduct>(`${this.api}/admin/products/${id}/archive`, null),
    );
    this.products.reload();
    return p;
  }

  preview(id: string): Promise<ProductDetail> {
    return firstValueFrom(this.http.get<ProductDetail>(`${this.api}/admin/products/${id}/preview`));
  }

  async saveCategory(id: string | null, body: CategoryInput): Promise<AdminCategory> {
    const c = id
      ? await firstValueFrom(
          this.http.put<AdminCategory>(`${this.api}/admin/categories/${id}`, body),
        )
      : await firstValueFrom(this.http.post<AdminCategory>(`${this.api}/admin/categories`, body));
    this.categories.reload();
    return c;
  }

  async upload(
    file: File,
    kind: 'image' | 'pdf' | 'book_file',
    altAr: string,
    altEn: string,
  ): Promise<MediaAsset> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (altAr.trim()) form.append('altAr', altAr.trim());
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

  stockRow(formatId: string): Promise<StockRow | undefined> {
    return firstValueFrom(this.http.get<StockRow[]>(`${this.api}/admin/stock`)).then((rows) =>
      rows.find((r) => r.formatId === formatId),
    );
  }

  moveStock(formatId: string, body: StockMovementRequest): Promise<StockRow> {
    return firstValueFrom(
      this.http.post<StockRow>(`${this.api}/admin/stock/${formatId}/movements`, body),
    );
  }
}
