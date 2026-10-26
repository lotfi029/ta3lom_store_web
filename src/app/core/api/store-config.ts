import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject } from '@angular/core';
import { toInt, type CatalogConfig } from './api.types';
import { refreshAfterHydration } from '../http/refresh-after-hydration';
import { valueOf } from '../http/resource-value';
import { STORE_API_URL } from './store-api-url';

/**
 * Public donation limits (`GET /v1/catalog/config`, contract 15 §2.1): minimum gift, line and cart maxima, the maximum
 * option quantity and the amount presets. Nothing in the web hard-codes these (W-5): every amount field, stepper and
 * preset list reads them here; a project's own `minAmount` overrides `minGiftAmount` for its open amount.
 *
 * Read during prerender too, so the response travels to the browser in the hydration transfer state (no flash of
 * missing presets); the browser then reloads it once the app is stable, because a prerendered value is as old as
 * the last build. Until the first answer, `ready()` is false and amount buttons stay disabled.
 */
@Injectable({ providedIn: 'root' })
export class StoreConfig {
  private readonly api = inject(STORE_API_URL);
  readonly resource = httpResource<CatalogConfig>(() => `${this.api}/catalog/config`);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) refreshAfterHydration(this.resource);
  }

  private readonly value = computed(() => valueOf(this.resource));
  readonly ready = computed(() => this.value() !== undefined);
  readonly minGiftAmount = computed(() => this.value()?.minGiftAmount ?? null);
  readonly maxLineAmount = computed(() => this.value()?.maxLineAmount ?? null);
  readonly cartMaxTotal = computed(() => this.value()?.cartMaxTotal ?? null);
  readonly cartMaxLines = computed(() => {
    const v = this.value();
    return v ? toInt(v.cartMaxLines) : null;
  });
  readonly maxQuantity = computed(() => {
    const v = this.value();
    return v ? toInt(v.maxQuantity) : null;
  });
  readonly amountPresets = computed<readonly string[]>(() => this.value()?.amountPresets ?? []);
}
