import {
  Component,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { I18nService } from '../../../core/i18n';

/** A move this list asked for and hasn't seen confirmed yet. */
interface PendingMove {
  id: string;
  /** Where the item should land once the caller's reload brings the new order back. */
  expectedIndex: number;
  /** Which button was pressed, so focus can follow the item; null for a drag. */
  direction: 'up' | 'down' | null;
}

/**
 * One primitive for the ~10 reorder endpoints (`PATCH /admin/<entity>/reorder`,
 * `{ ids: string[] }` — the FULL ordered id array of the group, a partial list is
 * `400 REORDER_INCOMPLETE`). Up/down buttons are the PRIMARY mechanism, not a fallback — every
 * reorder interaction needs a keyboard alternative (Part 4 gate), and native HTML5 drag is
 * layered on top for mouse users who prefer it, never the only way to reorder.
 *
 * Caller supplies row content via `<ng-template #item let-item>…</ng-template>`, same
 * content-projection contract as shared/ui/data-table's `#row`.
 *
 * The list holds no order of its own: it emits the new id array, and the caller PATCHes it and
 * reloads `items` only once the server has accepted it. So a move is announced, and focus put
 * back, when that new order ARRIVES — not when the button is pressed. Announcing on the press
 * told a screen-reader user an item had moved even when the save then failed.
 */
@Component({
  selector: 'ta-reorder-list',
  imports: [NgTemplateOutlet],
  templateUrl: './reorder-list.html',
  styleUrl: './reorder-list.css',
})
export class ReorderList<T extends { id: string }> {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly items = input.required<T[]>();
  readonly caption = input.required<string>();
  /** True while the caller's PATCH is in flight: moves are blocked, so a second move can't be sent
   *  from an order the server hasn't confirmed yet (a double submit). */
  readonly busy = input(false);
  /** Emits the full reordered id array — the caller PATCHes it, then reloads its own data
   *  resource; this component holds no server state of its own. */
  readonly reordered = output<string[]>();

  readonly itemTemplate = contentChild.required<TemplateRef<{ $implicit: T }>>('item');

  protected readonly draggedId = signal<string | null>(null);

  /** Drag reflows the DOM silently; a move has no visible change of its own beyond position, so
   *  SC 4.1.3 (Status Messages) needs this said out loud rather than left to be inferred. */
  protected readonly announcement = signal('');

  private pending: PendingMove | null = null;

  constructor() {
    // Runs when the caller hands back a new `items` array — i.e. its reload after the PATCH.
    effect(() => {
      const items = this.items();
      untracked(() => this.settle(items));
    });
  }

  protected move(index: number, direction: -1 | 1): void {
    const list = [...this.items()];
    const target = index + direction;
    // The end buttons are aria-disabled, not disabled (see the template), so they can still be
    // pressed: this is what makes them do nothing.
    if (this.busy() || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.pending = { id: list[target].id, expectedIndex: target, direction: direction < 0 ? 'up' : 'down' };
    this.reordered.emit(list.map((item) => item.id));
  }

  protected onDragStart(id: string): void {
    this.draggedId.set(id);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onDrop(targetId: string): void {
    const draggedId = this.draggedId();
    this.draggedId.set(null);
    if (this.busy() || !draggedId || draggedId === targetId) return;

    const list = [...this.items()];
    const fromIndex = list.findIndex((item) => item.id === draggedId);
    const toIndex = list.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    this.pending = { id: draggedId, expectedIndex: toIndex, direction: null };
    this.reordered.emit(list.map((item) => item.id));
  }

  /** The caller's new order has arrived: say whether the move stuck, and keep focus on the item. */
  private settle(items: T[]): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;

    const index = items.findIndex((item) => item.id === pending.id);
    this.announce(
      index === pending.expectedIndex
        ? this.i18n.pick(`نُقل إلى الموضع ${index + 1} من ${items.length}.`, `Moved to position ${index + 1} of ${items.length}.`)
        : this.i18n.pick('لم يُحفظ الترتيب.', 'The order was not saved.'),
    );

    // The row is re-rendered in its new place; put focus back on the button that was pressed, on
    // the item that moved, so pressing it again keeps moving that same item.
    if (pending.direction && index !== -1) {
      afterNextRender(
        () =>
          this.host.nativeElement
            .querySelector<HTMLElement>(`li[data-id="${CSS.escape(pending.id)}"] button[data-move="${pending.direction}"]`)
            ?.focus(),
        { injector: this.injector },
      );
    }
  }

  /** A live region only speaks when its text changes, so two moves to "position 2 of 5" in a row
   *  would say nothing the second time: empty it first, then write the message after a render. */
  private announce(message: string): void {
    this.announcement.set('');
    afterNextRender(() => this.announcement.set(message), { injector: this.injector });
  }
}
