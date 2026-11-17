import { computed, signal } from '@angular/core';

export type CheckState = 'none' | 'some' | 'all';

/**
 * Row selection scoped to the page on screen (03 §4): `reset()` on every page or filter change, so a bulk action never
 * reaches a row the user can no longer see.
 */
export class PageSelection {
  private readonly ids = signal<ReadonlySet<string>>(new Set());
  readonly selected = computed(() => [...this.ids()]);
  readonly count = computed(() => this.ids().size);

  has(id: string): boolean {
    return this.ids().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.ids());
    if (!next.delete(id)) next.add(id);
    this.ids.set(next);
  }

  /** Header checkbox: select every row of the page, or clear when all are already selected. */
  toggleAll(pageIds: readonly string[]): void {
    this.ids.set(this.state(pageIds) === 'all' ? new Set() : new Set(pageIds));
  }

  state(pageIds: readonly string[]): CheckState {
    const n = pageIds.filter((id) => this.ids().has(id)).length;
    return n === 0 ? 'none' : n === pageIds.length ? 'all' : 'some';
  }

  reset(): void {
    if (this.ids().size) this.ids.set(new Set());
  }
}
