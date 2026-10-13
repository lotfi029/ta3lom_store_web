/**
 * Global Vitest setup, wired via the "test" architect target's `setupFiles` in angular.json.
 *
 * jsdom does not implement HTMLDialogElement.showModal()/close() (a long-standing jsdom gap —
 * https://github.com/jsdom/jsdom/issues/3294). This is an ENVIRONMENT gap, not a code bug:
 * `shared/ui/dialog/dialog.ts` deliberately relies on the real native element (see its own
 * header comment) and every actual browser implements this correctly. Polyfilled once, here,
 * for every spec that renders <ta-dialog> — approximating real focus save/restore semantics
 * closely enough for `dialog.spec.ts`'s assertions, not a full HTML-spec implementation.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  const previouslyFocused = new WeakMap<HTMLDialogElement, Element | null>();

  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    previouslyFocused.set(this, document.activeElement);
    this.setAttribute('open', '');
    const focusable = this.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? this).focus();
  };

  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    const restore = previouslyFocused.get(this);
    this.dispatchEvent(new Event('close'));
    if (restore instanceof HTMLElement && document.contains(restore)) {
      restore.focus();
    }
  };

  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
}
