import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'cta' | 'ghost' | 'lite';
export type ButtonSize = 'md' | 'sm';

/**
 * Renders as a routed link when `routerLink` is set, a plain anchor when `href` is set,
 * or a native button otherwise. All three share the same minimum 44x44px target.
 * Content is projected once via an `<ng-template>` + `ngTemplateOutlet`, not three separate
 * `<ng-content>` tags under @if/@else — Angular only projects into the first `<ng-content>`
 * it finds across branches, silently dropping content in the others.
 *
 * `loading` (CR-01 FE-1) is for a submit or save that is in flight: a spinner replaces the label
 * WITHOUT changing the button's width (the label stays in layout, only hidden), `aria-busy`
 * tells assistive tech, and further presses do nothing. It deliberately does not set the native
 * `disabled`: that would drop keyboard focus to <body> mid-submit, and a screen-reader user would
 * lose their place. Clicks (and so implicit form submission) are swallowed instead.
 */
@Component({
  selector: 'ta-button',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly routerLink = input<string | undefined>(undefined);
  readonly fragment = input<string | undefined>(undefined);
  readonly href = input<string | undefined>(undefined);
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);

  protected onClick(event: Event): void {
    if (!this.loading()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
