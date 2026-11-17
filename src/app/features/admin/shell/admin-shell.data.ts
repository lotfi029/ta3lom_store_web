import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { type AdminProjectPage, toInt } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { StoreConfig } from '../../../core/api/store-config';
import { valueOf } from '../../../core/http/resource-value';
import { OpsData } from '../ops/ops.data';
import type { AdminNavBadge } from './admin-nav';

/** Minimum time between two dashboard reads triggered by navigation (docs/admin-redesign/03 §3). */
export const COUNTS_THROTTLE_MS = 30_000;

/**
 * Live counts for the shell (nav badges, the bell): one `GET /v1/admin/dashboard` (03 §13.2), shared with the
 * dashboard page through `OpsData.dashboard`. Optional fields the API leaves out stay `null` — nothing is invented.
 */
@Injectable({ providedIn: 'root' })
export class AdminShellData {
  private readonly ops = inject(OpsData);
  private readonly config = inject(StoreConfig);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StaffAuth);
  private lastRefresh = 0;

  /** Command palette text search: `GET /v1/admin/projects?q=…&pageSize=5` — never a whole list (03 §3). */
  readonly projectQuery = signal('');
  readonly projectMatches = httpResource<AdminProjectPage>(() => {
    const q = this.projectQuery().trim();
    return q.length >= 2 && this.auth.can('staff:read')
      ? { url: `${this.api}/admin/projects`, params: { q, page: 1, pageSize: 5 } }
      : undefined;
  });

  private readonly d = computed(() => valueOf(this.ops.dashboard));
  readonly pendingToday = computed(() => this.count(this.d()?.pendingOrdersToday));
  readonly inReview = computed(() => this.count(this.d()?.inReviewOrders));
  readonly orphans = computed(() => this.count(this.d()?.openOrphanPayments));
  /** Showcase mode on the API (payments off): the notice in the shell, menu and lists. Null until the config answers. */
  readonly paymentsOff = computed(() => this.config.paymentsEnabled() === false);
  /** The bell's total (only the counts the API returned). */
  readonly alerts = computed(
    () => (this.pendingToday() ?? 0) + (this.inReview() ?? 0) + (this.orphans() ?? 0),
  );

  badge(kind: AdminNavBadge | undefined): number | null {
    switch (kind) {
      case 'pendingToday':
        return this.pendingToday();
      case 'inReview':
        return this.inReview();
      case 'orphans':
        return this.orphans();
      default:
        return null;
    }
  }

  /** Reload the counts after a navigation, at most once per `COUNTS_THROTTLE_MS`. */
  refresh(now = Date.now()): void {
    if (now - this.lastRefresh < COUNTS_THROTTLE_MS) return;
    this.lastRefresh = now;
    this.ops.dashboard.reload();
  }

  private count(v: number | string | null | undefined): number | null {
    return v === null || v === undefined ? null : toInt(v);
  }
}
