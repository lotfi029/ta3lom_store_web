import { HttpErrorResponse } from '@angular/common/http';
import { bulkFailure } from '../../catalog/projects.page';
import { runBulk } from './bulk-runner';
import { PageSelection } from './selection';

describe('index page pieces (W-A2)', () => {
  it('selection is page-scoped with a tri-state header', () => {
    const s = new PageSelection();
    const page = ['a', 'b', 'c'];
    expect(s.state(page)).toBe('none');
    s.toggle('a');
    expect(s.state(page)).toBe('some');
    s.toggleAll(page);
    expect(s.state(page)).toBe('all');
    expect(s.count()).toBe(3);
    s.toggleAll(page);
    expect(s.count()).toBe(0);
    s.toggle('b');
    s.reset();
    expect(s.selected()).toEqual([]);
  });

  it('bulk runs one call per id, 2 at a time, keeps order and never retries a failure', async () => {
    let running = 0;
    let peak = 0;
    const calls: string[] = [];
    const results = await runBulk(['p1', 'p2', 'p3', 'p4'], async (id) => {
      calls.push(id);
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (id === 'p3')
        throw new HttpErrorResponse({
          status: 422,
          error: { code: 'project.not_publishable', missing: ['cover', 'amount'] },
        });
    });
    expect(peak).toBe(2);
    expect(calls.sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(results.map((r) => [r.id, r.ok])).toEqual([
      ['p1', true],
      ['p2', true],
      ['p3', false],
      ['p4', true],
    ]);
    expect(bulkFailure(results[2]!, 'سقيا')).toBe(
      'سقيا: صورة الغلاف، خيار تبرع نشط أو السماح بمبلغ مفتوح',
    );
  });

  it('a failure without missing[] shows the problem message', async () => {
    const [r] = await runBulk(['x'], () =>
      Promise.reject(new HttpErrorResponse({ status: 404, error: { code: 'project.not_found' } })),
    );
    expect(r!.ok).toBe(false);
    expect(bulkFailure(r!, 'X')).toMatch(/^X: .+/);
  });
});
