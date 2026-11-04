/**
 * Value equality for catalogue resources refreshed after hydration (refresh-after-hydration): the reload usually
 * returns exactly what the prerender embedded, and an identical answer must not re-render the page (owner brief P4:
 * that second render was the largest long task on the home page — TBT). Responses are plain JSON, so comparing the
 * serialised forms is exact.
 */
export function sameJson<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
