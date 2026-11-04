import { PLATFORM_ID, TransferState, makeStateKey, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hydrationSnapshot } from './hydration-snapshot';

function fakeResource<T>() {
  const value = signal<T | undefined>(undefined);
  const error = signal<unknown>(undefined);
  return {
    value,
    error,
    res: { hasValue: () => value() !== undefined, value: () => value() as T, error: () => error() },
  };
}

describe('hydrationSnapshot (prerendered value at the first browser render)', () => {
  it('browser: stands in for a loading resource with the same key, or before the key is bound', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    TestBed.inject(TransferState).set(makeStateKey<{ k: string; v: string }>('snap:t'), {
      k: 'a',
      v: 'prerendered',
    });
    const key = signal<string | null>(null);
    const r = fakeResource<string>();
    const s = TestBed.runInInjectionContext(() => hydrationSnapshot(r.res, 't', () => key()));

    expect(s.hasValue()).toBe(true); // key not bound yet (hydration)
    expect(s.value()).toBe('prerendered');
    key.set('a');
    expect(s.value()).toBe('prerendered');
    key.set('b'); // another request: no stand-in
    expect(s.hasValue()).toBe(false);
    key.set('a');
    r.value.set('fresh');
    expect(s.value()).toBe('fresh'); // the real answer wins
  });

  it('browser: keeps the prerendered value while a refresh of the same request fails (P5)', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    TestBed.inject(TransferState).set(makeStateKey<{ k: string; v: string }>('snap:t'), {
      k: 'a',
      v: 'prerendered',
    });
    const r = fakeResource<string>();
    r.error.set(new Error('down'));
    const s = TestBed.runInInjectionContext(() => hydrationSnapshot(r.res, 't', () => 'a'));
    expect(s.value()).toBe('prerendered');
    expect(s.error()).toBeTruthy();
  });

  it('browser without a snapshot: the resource as it is', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    const r = fakeResource<string>();
    const s = TestBed.runInInjectionContext(() => hydrationSnapshot(r.res, 'none', () => null));
    expect(s.hasValue()).toBe(false);
  });

  it('server: records the value and its key in TransferState', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const r = fakeResource<string>();
    TestBed.runInInjectionContext(() => hydrationSnapshot(r.res, 't', () => 'k1'));
    r.value.set('rendered');
    TestBed.tick();
    expect(TestBed.inject(TransferState).get(makeStateKey('snap:t'), null)).toEqual({
      k: 'k1',
      v: 'rendered',
    });
  });
});
