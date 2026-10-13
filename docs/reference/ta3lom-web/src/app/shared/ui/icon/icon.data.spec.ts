import { describe, expect, it } from 'vitest';
import { ICON_NAMES, ICON_PATHS, UI_ICON_NAMES, UI_ICON_PATHS, isIconName } from './icon.data';

/**
 * `isIconName` is the guard every caller uses before rendering `<ta-icon>` — the footer, the
 * contact page and the admin preview all fall back to something else when it returns false.
 *
 * That matters because `ContactChannel.icon` is a plain string column. The API validates writes
 * against its own CHANNEL_ICONS list, but rows predating that validation (or written directly)
 * can still hold anything, and `ICON_PATHS[unknown]` would be `undefined` — a `<path d>` with no
 * data, i.e. an invisible glyph where a link's only visible content should be.
 */
describe('icon.data', () => {
  it('has a path for every declared name', () => {
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name], name).toBeTruthy();
    }
  });

  it('ships the twelve keys the contact channels use', () => {
    // The ten the brief asked for, plus address and hours — the two remaining ChannelType values,
    // which the contact page now shows a glyph for.
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'address',
        'email',
        'facebook',
        'hours',
        'instagram',
        'linkedin',
        'phone',
        'tiktok',
        'website',
        'whatsapp',
        'x',
        'youtube',
      ].sort(),
    );
  });

  it('accepts a known key', () => {
    expect(isIconName('whatsapp')).toBe(true);
  });

  it('rejects an unknown key, an empty string, null and undefined', () => {
    // `mail`/`pin`/`clock` are the pre-rename keys; the migration renames them, and anything left
    // over must fall back rather than render an empty <path>.
    for (const value of ['mail', 'pin', 'clock', 'twitter', '', null, undefined]) {
      expect(isIconName(value), String(value)).toBe(false);
    }
  });

  it('keeps the interface glyphs out of the contact-channel list (the API would reject them)', () => {
    for (const name of UI_ICON_NAMES) {
      expect(UI_ICON_PATHS[name], name).toBeTruthy();
      expect(isIconName(name), name).toBe(false);
    }
  });
});
