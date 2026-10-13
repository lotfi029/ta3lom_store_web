import { Component, computed, input } from '@angular/core';
import { ICON_PATHS, IconName, UI_ICON_PATHS, UiIconName } from './icon.data';

/**
 * One inline SVG glyph from the shipped set (icon.data.ts).
 *
 * Inline rather than an external `<use href="icons.svg#name">` sprite: the footer renders on every
 * route, and a sprite is a second request that leaves the icons blank until it lands — worse here
 * than usual, because `public/` is duplicated per locale (ADR-002), so a relative sprite href is a
 * foot-gun. Inlining means the glyph is in the prerendered HTML and paints with the first frame.
 *
 * Always `aria-hidden`, and no label input: an icon here is decoration beside a link whose own
 * `aria-label` carries the accessible name (see footer.html). Because it is never content, the
 * required-alt rule for images (non-negotiable #6) does not apply.
 *
 * Never give these `.rtl-mirror`. Brand marks are not directional, and neither is a handset or an
 * envelope — mirroring them in Arabic would just render them wrong.
 */
@Component({
  selector: 'ta-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName | UiIconName>();
  readonly size = input(20);

  protected readonly path = computed(() => {
    const name = this.name();
    return name in UI_ICON_PATHS ? UI_ICON_PATHS[name as UiIconName] : ICON_PATHS[name as IconName];
  });
}
