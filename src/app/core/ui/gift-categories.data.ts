import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, Injector, afterNextRender, inject } from '@angular/core';
import type { Category } from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { SILENT } from '../http/error-toast.interceptor';
import { QuickDonate } from './quick-donate.service';

/**
 * Review 06 F-5: on a direct visit to `/p/…` or `/cart` no page reads `/catalog/categories`, so the quick-donate
 * count stayed unknown and the header/floating buttons showed even when no category takes general gifts. This root
 * service reads the categories ONCE, after the first render in the browser (never during the prerender), unless a page
 * (home) already set the count. Until the count is known — or when the read fails — the buttons stay hidden.
 * Silent: no error toast. A one-shot read, not an httpResource: nothing on screen binds to it.
 */
@Injectable({ providedIn: 'root' })
export class GiftCategories {
  private readonly api = inject(STORE_API_URL);
  private readonly http = inject(HttpClient);
  private readonly quick = inject(QuickDonate);
  private readonly injector = inject(Injector);
  private started = false;

  /** Call from the layout. */
  start(): void {
    if (this.started) return;
    this.started = true;
    afterNextRender(
      () => {
        if (this.quick.giftCategoryCount() !== null) return;
        this.http
          .get<Category[]>(`${this.api}/catalog/categories`, {
            context: new HttpContext().set(SILENT, true),
          })
          .subscribe({
            next: (list) =>
              this.quick.giftCategoryCount.set(list.filter((c) => c.acceptsGeneralGifts).length),
            error: () => undefined, // stays unknown → hidden
          });
      },
      { injector: this.injector },
    );
  }
}
