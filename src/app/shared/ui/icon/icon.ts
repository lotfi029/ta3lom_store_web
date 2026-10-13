import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DIRECTIONAL, ICONS, type IconName } from './icon.data';

interface Shape {
  tag: 'path' | 'circle' | 'rect';
  a: Record<string, string>;
}

const cache = new Map<IconName, Shape[]>();
function shapes(name: IconName): Shape[] {
  let parsed = cache.get(name);
  if (!parsed) {
    parsed = [...ICONS[name].matchAll(/<(path|circle|rect)\s([^>]*?)\/>/g)].map((m) => ({
      tag: m[1] as Shape['tag'],
      a: Object.fromEntries([...m[2].matchAll(/([a-z-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])),
    }));
    cache.set(name, parsed);
  }
  return parsed;
}

/**
 * One inline SVG glyph. Always `aria-hidden`: an icon is decoration beside text or inside a control whose own
 * accessible name carries the meaning. Directional glyphs (arrow, chevron) mirror in RTL. Shapes are rendered as real
 * template elements (no innerHTML).
 */
@Component({
  selector: 'ta-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    [class.mirror]="mirror()"
  >
    @for (s of shapes(); track $index) {
      @switch (s.tag) {
        @case ('path') {
          <path [attr.d]="s.a['d']" />
        }
        @case ('circle') {
          <circle [attr.cx]="s.a['cx']" [attr.cy]="s.a['cy']" [attr.r]="s.a['r']" />
        }
        @case ('rect') {
          <rect [attr.x]="s.a['x']" [attr.y]="s.a['y']" [attr.width]="s.a['width']" [attr.height]="s.a['height']" [attr.rx]="s.a['rx']" />
        }
      }
    }
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex: none;
    }
    :host-context([dir='rtl']) .mirror {
      transform: scaleX(-1);
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  protected readonly shapes = computed(() => shapes(this.name()));
  protected readonly mirror = computed(() => DIRECTIONAL.has(this.name()));
}
