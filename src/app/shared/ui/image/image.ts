import { Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

/**
 * Wraps NgOptimizedImage. `alt` is a required input — this is how F-17 (53 of 72 images
 * with no alt text on the old site) stays closed structurally, not by convention.
 */
@Component({
  selector: 'ta-image',
  imports: [NgOptimizedImage],
  templateUrl: './image.html',
})
export class Image {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly priority = input(false);
  readonly imgClass = input('');
}
