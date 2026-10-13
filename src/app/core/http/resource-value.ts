/**
 * A resource's value, or undefined while it has none — including in the error state, where Angular's `value()` throws.
 * Read every httpResource through this in computed signals and templates.
 */
export function valueOf<T>(res: { hasValue(): boolean; value(): T }): T | undefined {
  return res.hasValue() ? res.value() : undefined;
}
