import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import type { Category } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { valueOf } from '../../../core/http/resource-value';
import { QuickDonate } from '../../../core/ui/quick-donate.service';

/** Categories that take general gifts (M-5): active ones (the public list) with `acceptsGeneralGifts`. */
export const giftCategories = (all: readonly Category[]): Category[] =>
  all.filter((c) => c.acceptsGeneralGifts);

/** The quick-donate modal's data: `GET /v1/catalog/categories`, loaded when the modal opens. */
@Injectable()
export class QuickDonateData {
  private readonly api = inject(STORE_API_URL);
  private readonly qd = inject(QuickDonate);
  readonly categories = httpResource<Category[]>(() =>
    this.qd.used() ? `${this.api}/catalog/categories` : undefined,
  );
  readonly list = computed(() => giftCategories(valueOf(this.categories) ?? []));
}
