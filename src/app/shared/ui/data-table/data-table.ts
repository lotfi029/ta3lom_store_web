import { Component, TemplateRef, computed, contentChild, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toInt } from '../../../core/api/api.types';
import type { PagedLike } from '../../../core/api/paged';

export type PagedData<T> = PagedLike<T>;

/**
 * Generic paginated table — one component serves all six admin content types. The caller
 * supplies the header row via `<ng-template #header><tr>…</tr></ng-template>` (optional) and
 * each body row via `<ng-template #row let-item><td>…</td></ng-template>` (the `<tr>` wrapper
 * is this component's job); `caption` is required so every instance has its own accessible
 * name — six different content types sharing one table need six different names.
 */
@Component({
  selector: 'ta-data-table',
  imports: [NgTemplateOutlet],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
// `T extends { id: string }` so `data-table.html` can `track item.id` instead of `$index`
// (M6, admin-dashboard-code-review.md) — the same constraint `ReorderList` already has, for the
// same reason: with reload-after-every-mutation, deleting row 2 of 30 re-keyed every row below
// it under `track $index`, forcing Angular to re-render thumbnails and status pills in place
// rather than just removing one, and any row-level DOM state (focus, an open menu) ended up
// attached to the wrong record mid-update.
export class DataTable<T extends { id: string }> {
  readonly data = input.required<PagedData<T>>();
  readonly caption = input.required<string>();
  readonly emptyMessage = input('');
  readonly pageChange = output<number>();

  readonly rowTemplate = contentChild.required<TemplateRef<{ $implicit: T }>>('row');
  readonly headerTemplate = contentChild<TemplateRef<void>>('header');

  // `size` is echoed by the API and should never be 0, but Math.ceil(n / 0) is Infinity, not an
  // error — a caller's fallback envelope with size:0 (or the API changing shape) would otherwise
  // render "5 / Infinity" instead of failing loudly. size <= 0 falls back to `total` itself, so
  // the pager still shows something coherent (one giant page) rather than a broken number.
  protected readonly page = computed(() => toInt(this.data().page, 1));
  protected readonly totalPages = computed(() => {
    const total = toInt(this.data().total);
    const size = toInt(this.data().pageSize);
    return Math.max(1, Math.ceil(total / (size > 0 ? size : Math.max(total, 1))));
  });
}
