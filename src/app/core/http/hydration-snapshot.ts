import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, TransferState, computed, effect, inject, makeStateKey } from '@angular/core';

export interface ResourceLike<T> {
  hasValue(): boolean;
  value(): T;
  error(): unknown;
}

interface Snapshot<T> {
  /** The request key the value answered (e.g. the listing query, the project slug). */
  k: string | null;
  v: T;
}

/**
 * The prerendered value of a resource, available at the FIRST browser render.
 *
 * Why: an `httpResource` resolves asynchronously, and the pages set their request key (query, slug) in an effect, so
 * while Angular hydrates a prerendered page the resource is still "loading, no value". The template then takes its
 * loading branch, the hydrated DOM does not match, and Angular throws the prerendered grid (or the whole project
 * page, LCP image included) away and builds it again — wasted main-thread time and a late repaint (UX pass).
 *
 * Server: the resource's value and its key are written to TransferState. Browser: while the resource has no value
 * yet, the snapshot stands in — only for the same key, or before the page has bound its key (`null`). A failed
 * refresh of the same request keeps showing it (the page's stale notice comes from `error()`, unchanged).
 * Call in an injection context.
 */
export function hydrationSnapshot<T>(
  res: ResourceLike<T>,
  name: string,
  key: () => string | null,
): ResourceLike<T> {
  const state = inject(TransferState);
  const stateKey = makeStateKey<Snapshot<T>>(`snap:${name}`);
  if (isPlatformServer(inject(PLATFORM_ID))) {
    effect(() => {
      if (res.hasValue()) state.set(stateKey, { k: key(), v: res.value() });
    });
    return res;
  }
  const snap = state.get(stateKey, null);
  const usable = computed(() => {
    if (!snap || res.hasValue()) return false;
    const k = key();
    return k === null || k === snap.k;
  });
  return {
    hasValue: () => res.hasValue() || usable(),
    value: () => (res.hasValue() ? res.value() : (snap as Snapshot<T>).v),
    error: () => res.error(),
  };
}
