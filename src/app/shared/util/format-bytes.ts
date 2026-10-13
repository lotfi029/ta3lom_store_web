/**
 * Human-readable file size — "1.2 MB", "840 B". Moved out of features/about/about.data.ts
 * (where it was private) because shared/ui/asset-preview needs the identical formatting and
 * `shared/` may never import from `features/` (02-frontend-architecture.md's dependency
 * direction). features/media/media.data.ts's own docMeta() has a second, cruder inline
 * duplicate (always MB, no KB/GB tiers) — left as-is here since touching it is unrelated to
 * this move, but it is a candidate to repoint at this function later.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
