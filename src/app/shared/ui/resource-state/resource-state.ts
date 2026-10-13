import { Component, input, output } from '@angular/core';
import { Button } from '../button/button';

/**
 * The three-branch loading/error/content pattern that only `media-library.html` and part of
 * `overview.html` got right (H3, admin-dashboard-code-review.md).
 *
 * `httpResource.value()` is `undefined` both WHILE loading and AFTER a failed request —
 * collapsing those two into "no items", which every other admin list did
 * (`data.list.value() ?? { items: [], ... }`), means every page load flashes an empty message
 * before the rows appear, AND a genuine failure — the API down, an expired session, a 500 —
 * shows that same empty message permanently. An editor looking at "لا توجد منشورات بعد." after
 * a failed request has no way to tell their content was never lost at all.
 *
 * Usage — wrap the content that only makes sense once the resource has resolved:
 * ```html
 * <ta-resource-state
 *   [loading]="data.list.isLoading()"
 *   [error]="!!data.list.error()"
 *   (retry)="data.list.reload()"
 * >
 *   <ta-data-table ... />
 * </ta-resource-state>
 * ```
 * `loading`/`error` are booleans, not the resource itself, so this has no dependency on
 * `httpResource`'s type and works equally for a plain `computed` that tracks some other
 * loading/error pair (categories.ts's `resourceFor(scope)`, for one).
 */
@Component({
  selector: 'ta-resource-state',
  imports: [Button],
  templateUrl: './resource-state.html',
  styleUrl: './resource-state.css',
})
export class ResourceState {
  readonly loading = input.required<boolean>();
  readonly error = input.required<boolean>();
  /** Overrides the default bilingual error line — most callers don't need this. */
  readonly errorMessage = input<string>();

  readonly retry = output<void>();
}
