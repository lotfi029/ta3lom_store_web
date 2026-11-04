import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DIRECTIONAL, ICONS, type IconName } from './icon.data';

const n = (a: Record<string, string>, k: string): number => Number(a[k] ?? 0);
const fmt = (x: number): string => String(Math.round(x * 1000) / 1000);

/** One SVG shape (path, circle, ellipse, rect with optional rx) as path data. */
export function shapeToPath(tag: string, a: Record<string, string>): string {
  switch (tag) {
    case 'path':
      return a['d'] ?? '';
    case 'circle':
    case 'ellipse': {
      const cx = n(a, 'cx');
      const cy = n(a, 'cy');
      const rx = tag === 'circle' ? n(a, 'r') : n(a, 'rx');
      const ry = tag === 'circle' ? rx : n(a, 'ry');
      const arc = `a${fmt(rx)} ${fmt(ry)} 0 1 0`;
      return `M${fmt(cx - rx)} ${fmt(cy)}${arc} ${fmt(2 * rx)} 0${arc} ${fmt(-2 * rx)} 0z`;
    }
    case 'rect': {
      const x = n(a, 'x');
      const y = n(a, 'y');
      const w = n(a, 'width');
      const h = n(a, 'height');
      const r = Math.min(n(a, 'rx'), w / 2, h / 2);
      if (r <= 0) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
      const c = (dx: number, dy: number) => `a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(dx)} ${fmt(dy)}`;
      return (
        `M${fmt(x + r)} ${fmt(y)}h${fmt(w - 2 * r)}${c(r, r)}v${fmt(h - 2 * r)}${c(-r, r)}` +
        `h${fmt(-(w - 2 * r))}${c(-r, -r)}v${fmt(-(h - 2 * r))}${c(r, -r)}z`
      );
    }
    default:
      return '';
  }
}

const cache = new Map<IconName, string>();
/** Every shape of an icon as ONE path `d` (parsed once per icon name). */
export function iconPath(name: IconName): string {
  let d = cache.get(name);
  if (d === undefined) {
    d = [...ICONS[name].matchAll(/<(path|circle|ellipse|rect)\s([^>]*?)\/>/g)]
      .map((m) => shapeToPath(m[1], Object.fromEntries([...m[2].matchAll(/([a-z-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]))))
      .join('');
    cache.set(name, d);
  }
  return d;
}

/**
 * One inline SVG glyph. Always `aria-hidden`: an icon is decoration beside text or inside a control whose own
 * accessible name carries the meaning. Directional glyphs (arrow, chevron) mirror in RTL. Shapes are rendered as real
 * template elements (no innerHTML). F6.5: all shapes are one `<path>` (circles, ellipses and rects converted to path
 * data once per name) — one element and no embedded views per icon, so hydrating a page full of icons is cheap.
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
    <path [attr.d]="d()" />
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
  protected readonly d = computed(() => iconPath(this.name()));
  protected readonly mirror = computed(() => DIRECTIONAL.has(this.name()));
}
