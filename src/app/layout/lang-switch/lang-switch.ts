import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n';

/**
 * The same page in the other locale: `/{target}{path}{?query}`. Each locale is its own build under /ar/ and /en/, so
 * switching is a full navigation, never to the home page.
 */
export function localeHref(currentUrl: string, target: 'ar' | 'en'): string {
  const path = currentUrl.replace(/^\/(ar|en)(?=\/|$|\?)/, '') || '/';
  return `/${target}${path.startsWith('/') ? path : `/${path}`}`;
}

@Component({
  selector: 'ta-lang-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="lang" [href]="href()" [attr.hreflang]="target" [attr.lang]="target">{{ label }}</a>`,
  styleUrl: './lang-switch.css',
})
export class LangSwitch {
  private readonly router = inject(Router);
  protected readonly target = inject(I18nService).otherLocale;
  protected readonly label = this.target === 'en' ? 'EN' : 'عربي';
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly href = computed(() => localeHref(this.url(), this.target));
}
