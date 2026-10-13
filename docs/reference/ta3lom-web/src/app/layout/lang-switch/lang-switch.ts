import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n';

/**
 * Pure so the path-preservation contract — switching locale on a nested page lands on the SAME
 * page, never the home page — can be tested without a TestBed.
 *
 * Always emits the plain `/{locale}{path}` form, in development too: those prefixes are real
 * directories in the deployed build, and locally core/locale-prefix.guard.ts translates them
 * into whatever the dev servers need. Keeping that knowledge in one place means this component
 * produces the same href everywhere, and the URL a visitor copies out of dev matches production.
 */
export function localeHref(currentUrl: string, target: 'ar' | 'en'): string {
  const path = currentUrl.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
  return `/${target}${path}`;
}

/**
 * Each locale is a SEPARATE prerendered build (ADR-002) served at /ar/ or /en/, so
 * switching is a full navigation to the equivalent path under the other locale's
 * directory — never to the home page.
 */
@Component({
  selector: 'ta-lang-switch',
  templateUrl: './lang-switch.html',
  styleUrl: './lang-switch.css',
})
export class LangSwitch {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly targetLocale = computed(() => (this.i18n.locale === 'ar' ? 'en' : 'ar'));
  protected readonly targetLabel = computed(() => (this.targetLocale() === 'en' ? 'EN' : 'عربي'));

  protected targetHref(): string {
    return localeHref(this.router.url, this.targetLocale());
  }
}
