import { Injectable, signal } from '@angular/core';

/**
 * Opens the quick-donate modal ("تبرع سريع", donations MVP §1.3) from anywhere — the header button and the floating side
 * button in the layout. The modal itself lives in the app root and is loaded on first use (`@defer`), so the initial
 * bundle carries only this flag.
 */
@Injectable({ providedIn: 'root' })
export class QuickDonate {
  readonly open = signal(false);
  /** True once opened: the deferred modal stays loaded afterwards. */
  readonly used = signal(false);
  /** The control to give focus back to when the modal closes (the native dialog restores it on its own too). */
  private opener: HTMLElement | null = null;

  show(opener?: EventTarget | null): void {
    this.opener = opener instanceof HTMLElement ? opener : null;
    this.used.set(true);
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
    this.opener?.focus();
    this.opener = null;
  }
}
