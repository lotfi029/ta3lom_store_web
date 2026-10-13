/** The list envelope of 11 §1.4 (`{ items, total, page, pageSize }`) — page maths for list screens. */
import { toInt } from './api.types';

export interface PagedLike<T> {
  items: T[];
  total: number | string;
  page: number | string;
  pageSize: number | string;
}

export function pageCount(p: PagedLike<unknown> | undefined): number {
  if (!p) return 0;
  const size = Math.max(1, toInt(p.pageSize, 20));
  return Math.max(1, Math.ceil(toInt(p.total) / size));
}
