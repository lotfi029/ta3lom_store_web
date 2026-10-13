import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Base content card; becomes the link variant (lifts on hover) when routerLink/href is set.
 * Content is projected once via an `<ng-template>` + `ngTemplateOutlet`, not three separate
 * `<ng-content>` tags under @if/@else — Angular only projects into the first `<ng-content>`
 * it finds across branches, silently dropping content in the others.
 */
@Component({
  selector: 'ta-card',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class Card {
  readonly routerLink = input<string | undefined>(undefined);
  readonly href = input<string | undefined>(undefined);
  readonly variant = input<'default' | 'white' | 'tint'>('default');
}
