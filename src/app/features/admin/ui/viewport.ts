import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** docs/admin-redesign/02 §3 — phones get card lists instead of tables. */
export const ADMIN_PHONE_QUERY = '(width <= 640px)';

/**
 * The admin's phone breakpoint as a signal, so a page renders EITHER its table OR its card list (`@if`), never both
 * (review S11: a screen reader must not read the same rows twice).
 */
@Injectable({ providedIn: 'root' })
export class AdminViewport {
  readonly phone = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const mq = window.matchMedia(ADMIN_PHONE_QUERY);
    this.phone.set(mq.matches);
    const on = (e: MediaQueryListEvent) => this.phone.set(e.matches);
    mq.addEventListener('change', on);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', on));
  }
}
