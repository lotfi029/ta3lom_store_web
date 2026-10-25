import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../../core/seo/seo.service';

/** TEMPORARY (W-M0 only): an admin screen rebuilt for the R5 API in W-M5 of this PR. */
@Component({
  selector: 'ta-admin-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 i18n="@@store.placeholder.title">متجر التبرعات</h1>
    <p i18n="@@store.placeholder.lede">هذه الصفحة قيد التحديث لمتجر التبرعات.</p>
  `,
})
export class AdminPlaceholder {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({ title: 'Admin', description: '', path: '/admin', noindex: true });
  }
}
