import { nextAway } from './header';

describe('header hide-on-scroll (narrow screens)', () => {
  const narrow = { narrow: true, menuOpen: false, focusInside: false };

  it('goes away scrolling down past the top, comes back on a scroll up', () => {
    expect(nextAway(false, 300, 340, narrow)).toBe(true);
    expect(nextAway(true, 340, 330, narrow)).toBe(false);
    expect(nextAway(true, 340, 337, narrow)).toBe(true); // a 3 px jitter keeps the state
    expect(nextAway(false, 340, 343, narrow)).toBe(false);
  });

  it('never hides near the top, on wide screens, with the menu open or focus inside', () => {
    expect(nextAway(true, 100, 150, narrow)).toBe(false);
    expect(nextAway(false, 300, 400, { ...narrow, narrow: false })).toBe(false);
    expect(nextAway(false, 300, 400, { ...narrow, menuOpen: true })).toBe(false);
    expect(nextAway(true, 300, 400, { ...narrow, focusInside: true })).toBe(false);
  });
});
