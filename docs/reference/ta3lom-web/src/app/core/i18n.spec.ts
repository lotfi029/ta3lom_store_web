import { describe, expect, it } from 'vitest';
import { pick } from './i18n';

/**
 * CLAUDE.md non-negotiable #3 / docs/architecture/08-testing-and-budgets.md: English falls
 * back to Arabic, and the whitespace case is the one that ships broken — an editor who types
 * a single space into the English field produces a truthy string, and `en || ar` renders a
 * blank heading unless the fallback trims first.
 */
describe('pick', () => {
  it('returns Arabic in the Arabic locale regardless of English', () => {
    expect(pick('ar', 'عربي', 'English')).toBe('عربي');
  });

  it('returns the English value in the English locale when present', () => {
    expect(pick('en', 'عربي', 'English')).toBe('English');
  });

  it('falls back to Arabic when English is undefined', () => {
    expect(pick('en', 'عربي')).toBe('عربي');
  });

  it('falls back to Arabic when English is null', () => {
    expect(pick('en', 'عربي', null)).toBe('عربي');
  });

  it('falls back to Arabic when English is an empty string', () => {
    expect(pick('en', 'عربي', '')).toBe('عربي');
  });

  it('falls back to Arabic when English is whitespace only', () => {
    expect(pick('en', 'عربي', '   ')).toBe('عربي');
  });

  it('never returns an empty string for the English locale', () => {
    expect(pick('en', 'عربي', null)).not.toBe('');
    expect(pick('en', 'عربي', '   ')).not.toBe('');
  });
});
