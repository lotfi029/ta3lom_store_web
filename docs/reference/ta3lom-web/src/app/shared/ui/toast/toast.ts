import { Component, DestroyRef, effect, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n';
import { ToastService } from '../../../core/toast.service';

const AUTO_DISMISS_MS = 6000;

/**
 * Renders ToastService.current() — see that service's own comment: "the visual toast is a
 * shared/ui component ... error.interceptor.ts pushes here on a 5xx". Session 2, Part 1: this
 * component finally exists. Rendered once at the app root (app.html), outside both the public
 * and admin layouts, so a toast from either surface is visible regardless of which chrome is
 * active. `role="status"` + `aria-live="polite"` announces it without moving focus.
 *
 * WCAG 2.2.1 (Timing Adjustable) — a11y-auditor finding: a fixed 6s auto-dismiss with no way to
 * pause or extend it can hide a toast (including a 5xx error message) before a low-vision,
 * screen-magnifier, or screen-reader user has finished reading it. The timer pauses on
 * hover/focus and resumes on the corresponding leave/blur, via (mouseenter)/(mouseleave)/
 * (focusin)/(focusout) in toast.html.
 */
@Component({
  selector: 'ta-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class Toast {
  private readonly toastService = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly current = this.toastService.current;
  protected readonly dismissLabel = this.i18n.pick('إغلاق', 'Dismiss');

  constructor() {
    effect(() => {
      const toast = this.current();
      clearTimeout(this.timer);
      if (toast) {
        this.startTimer();
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  private startTimer(): void {
    this.timer = setTimeout(() => this.toastService.dismiss(), AUTO_DISMISS_MS);
  }

  protected pauseTimer(): void {
    clearTimeout(this.timer);
  }

  protected resumeTimer(): void {
    if (this.current()) this.startTimer();
  }

  protected onDismiss(): void {
    clearTimeout(this.timer);
    this.toastService.dismiss();
  }
}
