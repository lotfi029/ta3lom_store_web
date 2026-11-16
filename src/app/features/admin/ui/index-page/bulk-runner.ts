import { type StoreProblem, toProblem } from '../../../../core/api/problem';

export interface BulkResult {
  id: string;
  ok: boolean;
  problem?: StoreProblem;
}

/**
 * Runs one API call per id, at most `concurrency` at a time (03 §4, review M5). A failure is recorded for that id and
 * never retried; the others continue. Results come back in the order of `ids`.
 */
export async function runBulk(
  ids: readonly string[],
  call: (id: string) => Promise<unknown>,
  concurrency = 2,
): Promise<BulkResult[]> {
  const results: BulkResult[] = new Array(ids.length);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      const id = ids[i]!;
      try {
        await call(id);
        results[i] = { id, ok: true };
      } catch (err) {
        results[i] = { id, ok: false, problem: toProblem(err) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return results;
}
