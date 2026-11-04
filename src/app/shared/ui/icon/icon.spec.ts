import { ICONS, type IconName } from './icon.data';
import { absoluteStart, iconPath, shapeToPath } from './icon';

describe('Icon (F6.5: one path per icon)', () => {
  it('converts circles, ellipses and rounded rects to closed path data', () => {
    expect(shapeToPath('circle', { cx: '12', cy: '12', r: '3' })).toBe('M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z');
    expect(shapeToPath('ellipse', { cx: '12', cy: '6', rx: '7', ry: '2.5' })).toBe(
      'M5 6a7 2.5 0 1 0 14 0a7 2.5 0 1 0 -14 0z',
    );
    expect(shapeToPath('rect', { x: '4', y: '4', width: '6.5', height: '6.5', rx: '1' })).toBe(
      'M5 4h4.5a1 1 0 0 1 1 1v4.5a1 1 0 0 1 -1 1h-4.5a1 1 0 0 1 -1 -1v-4.5a1 1 0 0 1 1 -1z',
    );
    expect(shapeToPath('rect', { x: '0', y: '0', width: '2', height: '3' })).toBe('M0 0h2v3h-2z');
    expect(shapeToPath('path', { d: 'M1 2' })).toBe('M1 2');
  });

  it('every icon has path data for each of its shapes (none dropped, e.g. the coins ellipse)', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const shapes = ICONS[name].match(/<(path|circle|ellipse|rect)\s/g) ?? [];
      const d = iconPath(name);
      expect(d.length, name).toBeGreaterThan(0);
      expect((d.match(/M/gi) ?? []).length, name).toBeGreaterThanOrEqual(shapes.length);
    }
    expect(iconPath('coins')).toContain('a7 2.5');
  });

  it('a path starting with a relative m stays where it was once joined (search handle, share, mail…)', () => {
    expect(absoluteStart('m20 20-4.2-4.2')).toBe('M20 20l-4.2-4.2');
    expect(absoluteStart('m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1')).toBe('M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1');
    expect(absoluteStart('m13.5 6.5 4 4')).toBe('M13.5 6.5l4 4');
    expect(absoluteStart('M5 6h4')).toBe('M5 6h4');
    expect(absoluteStart('m3 4h2')).toBe('M3 4h2');
    for (const name of Object.keys(ICONS) as IconName[]) {
      // every shape, once converted, begins with an ABSOLUTE move-to, so joining shapes cannot shift any of them
      for (const m of ICONS[name].matchAll(/<(path|circle|ellipse|rect)\s([^>]*?)\/>/g)) {
        const attrs = Object.fromEntries([...m[2].matchAll(/([a-z-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
        expect(shapeToPath(m[1], attrs)[0], name).toBe('M');
      }
    }
    expect(iconPath('search')).toContain('M20 20l-4.2-4.2');
  });
});
