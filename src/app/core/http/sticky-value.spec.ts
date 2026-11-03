import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { stickyValue } from './sticky-value';

function fakeResource<T>() {
  const v = signal<T | undefined>(undefined);
  const err = signal<unknown>(null);
  return {
    hasValue: () => v() !== undefined,
    value: () => v() as T,
    error: () => err(),
    set: (x: T) => (v.set(x), err.set(null)),
    fail: () => (v.set(undefined), err.set(new Error('down'))),
  };
}

describe('stickyValue (P5: keep the prerendered data when a refresh fails)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }),
  );

  it('keeps the last good value when a reload of the SAME request fails', () => {
    TestBed.runInInjectionContext(() => {
      const r = fakeResource<number>();
      const key = signal('page-1');
      const s = stickyValue(r, key);
      r.set(1);
      expect(s()).toBe(1);
      r.fail();
      expect(s()).toBe(1);
      r.set(2);
      expect(s()).toBe(2);
    });
  });

  it('does not hide a failure for ANOTHER request', () => {
    TestBed.runInInjectionContext(() => {
      const r = fakeResource<number>();
      const key = signal('page-1');
      const s = stickyValue(r, key);
      r.set(1);
      expect(s()).toBe(1);
      key.set('page-2');
      r.fail();
      expect(s()).toBeUndefined();
    });
  });
});
