import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button } from '../../../shared/ui/button/button';
import { SeoService } from '../../../core/seo/seo.service';

/** 404 — any unknown path (client-rendered, noindex). */
@Component({
  selector: 'ta-not-found-page',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="nf wrap">
      <p class="code mono" aria-hidden="true">404</p>
      <h1 i18n="@@store.not-found.title">الصفحة غير موجودة</h1>
      <p class="lede" i18n="@@store.not-found.lede-r5">
        ربما نُقلت الصفحة أو لم تعد متاحة. تصفّح مشاريع التبرع من الصفحة الرئيسية.
      </p>
      <div class="cta">
        <ta-button routerLink="/" i18n="@@store.not-found.home">الصفحة الرئيسية للمتجر</ta-button>
      </div>
    </section>
  `,
  styles: `
    .nf {
      padding-block: var(--space-10);
      text-align: center;
    }
    .code {
      font-size: 4rem;
      color: var(--c-accent);
      margin: 0;
    }
    h1 {
      margin-block: var(--space-2) var(--space-3);
    }
    .lede {
      color: var(--c-text-2);
      max-inline-size: 46ch;
      margin-inline: auto;
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      justify-content: center;
      margin-block-start: var(--space-6);
    }
  `,
})
export class NotFoundPage {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.not-found.seo-title:الصفحة غير موجودة`,
      description: $localize`:@@store.not-found.lede-r5:ربما نُقلت الصفحة أو لم تعد متاحة. تصفّح مشاريع التبرع من الصفحة الرئيسية.`,
      path: '/404',
      noindex: true,
    });
  }
}
