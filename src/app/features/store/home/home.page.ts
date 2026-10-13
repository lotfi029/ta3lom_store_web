import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../../core/seo/seo.service';

/** W-00 placeholder — replaced by the real home page in W-03. */
@Component({
  selector: 'ta-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main" class="container">
      <h1 i18n="@@store.home.title">متجر جمعية التعلم الإلكتروني</h1>
    </main>
  `,
})
export class HomePage {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      description: $localize`:@@store.home.seo-description:دورات وكتب جمعية التعلم الإلكتروني: تسجيل فوري في الدورات، وكتب مطبوعة ورقمية.`,
      path: '/',
    });
  }
}
