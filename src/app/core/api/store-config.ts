import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject } from '@angular/core';
import type { CatalogConfig } from './api.types';
import { valueOf } from '../http/resource-value';
import { STORE_API_URL } from './store-api-url';

/**
 * Public store settings (#9 `GET /catalog/config`): shipping fee, print max quantity, payment methods, VAT flag.
 * r4 reads only the purchase settings; the giving presets the pre-r4 API still returns are ignored.
 * Browser only (never part of a prerendered snapshot). Defaults are the documented values until it answers.
 */
@Injectable({ providedIn: 'root' })
export class StoreConfig {
  private readonly api = inject(STORE_API_URL);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly resource = httpResource<CatalogConfig>(() => (this.browser ? `${this.api}/catalog/config` : undefined));

  readonly printMaxQuantity = computed(() => Number(valueOf(this.resource)?.printMaxQuantity ?? 20));
  readonly shippingFlatFee = computed(() => valueOf(this.resource)?.shippingFlatFee ?? '25.00');
  readonly paymentMethods = computed(() => valueOf(this.resource)?.paymentMethods ?? []);
  readonly vatEnabled = computed(() => valueOf(this.resource)?.vatEnabled ?? false);
}
