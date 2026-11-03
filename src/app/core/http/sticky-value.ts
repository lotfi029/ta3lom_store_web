import { Signal, computed, linkedSignal } from '@angular/core';
import { valueOf } from './resource-value';

interface Res<T> {
  hasValue(): boolean;
  value(): T;
  error(): unknown;
}

/**
 * The resource's value — or, while a RELOAD of the same request has failed, the last good value (owner brief P5: the
 * prerendered home keeps its grid when the API is down at runtime and says so). A failure for a DIFFERENT request
 * (another page, category, search) is not hidden: the value becomes undefined and the page shows its error state.
 */
export function stickyValue<T>(res: Res<T>, key: () => string = () => ''): Signal<T | undefined> {
  const held = linkedSignal<{ k: string; v: T | undefined }, { k: string; v: T | undefined }>({
    source: () => ({ k: key(), v: valueOf(res) }),
    computation: (now, prev) =>
      now.v === undefined && prev?.value.v !== undefined && prev.value.k === now.k && !!res.error()
        ? prev.value
        : now,
  });
  return computed(() => held().v);
}
