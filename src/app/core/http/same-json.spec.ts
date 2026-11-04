import { sameJson } from './same-json';

describe('sameJson (refresh after hydration, P4)', () => {
  it('equal JSON → equal; any change → different', () => {
    expect(sameJson({ a: [1, { b: '2.00' }] }, { a: [1, { b: '2.00' }] })).toBe(true);
    expect(sameJson({ a: [1, { b: '2.00' }] }, { a: [1, { b: '2.50' }] })).toBe(false);
    expect(sameJson(null, null)).toBe(true);
    expect(sameJson<unknown>(undefined, null)).toBe(false);
  });
});
