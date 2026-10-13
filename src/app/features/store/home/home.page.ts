import { ChangeDetectionStrategy, Component } from '@angular/core';

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
export class HomePage {}
