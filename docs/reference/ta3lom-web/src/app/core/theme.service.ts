import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/**
 * localStorage key for the visitor's choice. Unlike the access token (ADR-006) this is not
 * sensitive — an XSS payload learning "prefers dark" gains nothing — so localStorage is fine here.
 * The inline pre-paint script in src/index.html reads the SAME key; keep the two in step.
 */
export const THEME_STORAGE_KEY = 'ta-theme';

/**
 * Light / dark / follow-the-system (CR-01 FE-1, ADR-011).
 *
 * The first paint is NOT this service's job: a prerendered page would flash light for a dark-mode
 * visitor until the bundle booted. The tiny inline script in src/index.html sets
 * `<html data-theme>` before first paint, with the same rules as `effective` below; this service
 * then takes over, keeps the attribute in sync, persists changes and — while the preference is
 * `system` — follows the OS setting live.
 *
 * Browser-only side effects: on the server (prerender) it neither reads storage nor touches the
 * document, so the prerendered HTML carries no theme at all and the pre-paint script decides.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly preferenceState = signal<ThemePreference>(this.readStored());
  private readonly systemDark = signal(false);

  readonly preference = this.preferenceState.asReadonly();
  readonly effective = computed<Theme>(() => {
    const pref = this.preferenceState();
    if (pref !== 'system') return pref;
    return this.systemDark() ? 'dark' : 'light';
  });

  constructor() {
    if (!this.browser) return;
    const query = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (query) {
      this.systemDark.set(query.matches);
      query.addEventListener('change', (event) => this.systemDark.set(event.matches));
    }
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.effective());
    });
  }

  set(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    if (!this.browser) return;
    try {
      if (preference === 'system') this.document.defaultView?.localStorage.removeItem(THEME_STORAGE_KEY);
      else this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private mode / storage disabled: the choice still applies for this page view.
    }
  }

  /** The header button: flips what the visitor currently SEES, and pins that choice. */
  toggle(): void {
    this.set(this.effective() === 'dark' ? 'light' : 'dark');
  }

  private readStored(): ThemePreference {
    if (!this.browser) return 'system';
    try {
      const stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
