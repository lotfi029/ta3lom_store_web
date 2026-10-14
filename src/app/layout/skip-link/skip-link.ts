import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** First focusable element on every route; visible on focus. The admin shell passes its own landmark id. */
@Component({
  selector: 'ta-skip-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="skip-link" [attr.href]="'#' + targetId()" i18n="@@store.layout.skip-link"
    >تخطَّ إلى المحتوى الرئيسي</a
  >`,
  styleUrl: './skip-link.css',
})
export class SkipLink {
  readonly targetId = input('main');
}
