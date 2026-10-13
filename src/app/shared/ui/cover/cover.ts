import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { CoverImage } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';
import { Icon } from '../icon/icon';
import { Image } from '../image/image';

/**
 * A product cover: the API `MediaAsset` (alt text from the asset, non-negotiable #12), or — when the product has no
 * cover yet — a tinted tile with the type glyph. The prototype's generated SVG art is not ported (plan §2.6).
 * `shape`: `tile` 16:10 (courses), `book` 3:4 (books).
 */
@Component({
  selector: 'ta-cover',
  imports: [Image, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fill-host]': 'fill()' },
  template: `
    <div class="cv" [class.book]="shape() === 'book'" [class.fill]="fill()">
      @if (cover(); as c) {
        <ta-image [src]="c.url" [alt]="alt()" [width]="w()" [height]="h()" [priority]="priority()" imgClass="img-cover" />
      } @else {
        <span class="ph" aria-hidden="true"><ta-icon [name]="shape() === 'book' ? 'book' : 'play'" [size]="44" /></span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .cv {
      aspect-ratio: 16 / 10;
      border-radius: 12px;
      overflow: hidden;
      background: var(--c-tint);
      display: grid;
      place-items: center;
    }
    .cv.book {
      aspect-ratio: 3 / 4;
    }
    :host(.fill-host) {
      block-size: 100%;
    }
    .cv.fill {
      aspect-ratio: auto;
      block-size: 100%;
      border-radius: 0;
    }
    .cv ta-image {
      inline-size: 100%;
      block-size: 100%;
      transition: transform 0.6s var(--ease);
    }
    .ph {
      color: var(--c-accent);
      opacity: 0.7;
    }
    @media (prefers-reduced-motion: reduce) {
      .cv ta-image {
        transition: none;
      }
    }
  `,
})
export class Cover {
  private readonly i18n = inject(I18nService);
  readonly cover = input<CoverImage | null | undefined>(null);
  readonly shape = input<'tile' | 'book'>('tile');
  readonly priority = input(false);
  /** Fill the parent box (accordion art) instead of keeping the aspect ratio. */
  readonly fill = input(false);
  protected readonly alt = computed(() => {
    const c = this.cover();
    return c?.altAr ? this.i18n.pick(c.altAr, c.altEn) : '';
  });
  protected readonly w = computed(() => toInt(this.cover()?.width, 1200) || 1200);
  protected readonly h = computed(() => toInt(this.cover()?.height, 800) || 800);
}
