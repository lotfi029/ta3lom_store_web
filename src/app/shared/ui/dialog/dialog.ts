import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';

/**
 * Built on the native <dialog> element rather than a custom overlay: showModal() already
 * gives a correct focus trap, Escape-to-close, and focus restored to the trigger on close —
 * @angular/aria has no dialog/modal primitive as of this version, and re-implementing what
 * the platform already does correctly would be the wrong trade.
 * Note: focus restoration on close only works if the element that opened the dialog is still
 * in the DOM when it closes — if a caller conditionally removes/re-renders that trigger while
 * the dialog is open, focus falls back to <body> instead.
 *
 * INVARIANT every caller must keep: the dialog carries no visible padding (see dialog.css) and its
 * in-flow content fills its box. Backdrop detection below relies on it — the only pixels that
 * hit-test to the <dialog> element itself are backdrop pixels. A caller that adds a gutter around
 * its content would make that gutter dismiss the dialog. dialog.spec.ts guards this.
 */
@Component({
  selector: 'ta-dialog',
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
})
export class Dialog {
  // model(), not input() — so onNativeClose() below can write this component's OWN copy back to
  // false the instant the native element closes (4.12, admin-dashboard-code-review.md). Every
  // caller still binds one-way, `[open]="expr"`, exactly as before — nothing about that syntax
  // changes, and this does not by itself make a caller's forgotten (closed) reset harmless (the
  // CALLER's own bound expression still has to transition back to false at some point for its
  // next `true` to register as a change at all — an `input()` would track that identically).
  // What it fixes is a narrower, real gap: with a plain `input()`, this component's OWN belief
  // about whether it is open could go stale independently of the caller entirely — the effect's
  // `!el.open` guard is read alongside `open()`, and `open()` had no way to become `false` on
  // its own once the DOM already had (a native Escape/backdrop close does not, and cannot,
  // notify an `input()`). A `model()` can correct itself the moment that happens, which is the
  // one part of this that was never in the caller's hands to get right or wrong.
  readonly open = model(false);
  /** Required, not optional — an unnamed dialog announces as nothing to a screen reader. */
  readonly labelledBy = input.required<string>();

  /**
   * Clicking the backdrop closes the dialog. On by default: a modal you cannot click away from is
   * the single most-reported annoyance in this admin, and the approved prototype dismisses this way
   * too (ta3lom-prototype.html:428). Turn it OFF for a dialog holding unsaved input, where a
   * mis-click would discard typed work — the alt-text editor is the one such case in this app.
   */
  readonly lightDismiss = input(true);

  readonly closed = output<void>();

  protected readonly dialogEl = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');

  /**
   * Whether the gesture that is currently in progress STARTED on the backdrop. Without this, a
   * text-selection drag that begins inside the box and releases outside it fires a click on the
   * <dialog> and would dismiss — losing the selection and the dialog in one go. Requiring both ends
   * of the gesture to be on the backdrop is what makes that safe, and is why this listens on
   * pointerdown/pointerup rather than click.
   */
  private downOnBackdrop = false;

  constructor() {
    effect(() => {
      const el = this.dialogEl().nativeElement;
      if (this.open() && !el.open) {
        this.downOnBackdrop = false;
        el.showModal();
      } else if (!this.open() && el.open) {
        el.close();
      }
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    this.downOnBackdrop = event.target === this.dialogEl().nativeElement;
  }

  protected onPointerUp(event: PointerEvent): void {
    const onBackdrop = this.downOnBackdrop && event.target === this.dialogEl().nativeElement;
    this.downOnBackdrop = false;
    if (!onBackdrop || !this.lightDismiss()) return;

    // close(), not closed.emit(): routing through the native close keeps one close path, so a
    // caller's (closed) cleanup sees a backdrop dismissal exactly as it sees Escape.
    this.dialogEl().nativeElement.close();
  }

  /** Fires for every close, whatever the cause (Escape, backdrop, programmatic). */
  protected onNativeClose(): void {
    // Self-heal FIRST: whatever the caller's own (closed) handler does or forgets to do, this
    // component's own model must agree with the DOM the instant the DOM changes.
    this.open.set(false);
    this.closed.emit();
  }
}
