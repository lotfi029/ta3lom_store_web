import { Component, LOCALE_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ReorderList } from './reorder-list';

interface Row {
  id: string;
  name: string;
}

/** Stands in for a screen: it records the emitted order, and the test decides when (and whether)
 *  the "server" accepts it by setting `items`, as a caller's reload would. */
@Component({
  imports: [ReorderList],
  template: `
    <ta-reorder-list
      [items]="items()"
      caption="ترتيب"
      [busy]="busy()"
      (reordered)="emitted.push($event)"
    >
      <ng-template #item let-row>{{ row.name }}</ng-template>
    </ta-reorder-list>
  `,
})
class Host {
  readonly items = signal<Row[]>([
    { id: 'a', name: 'أ' },
    { id: 'b', name: 'ب' },
    { id: 'c', name: 'ج' },
  ]);
  readonly busy = signal(false);
  readonly emitted: string[][] = [];
}

describe('ReorderList', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: 'ar' }],
    });
    const fixture = TestBed.createComponent(Host);
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const button = (id: string, dir: 'up' | 'down') =>
      el.querySelector<HTMLButtonElement>(`li[data-id="${id}"] button[data-move="${dir}"]`)!;
    const status = () => el.querySelector('[role="status"]')!.textContent!.trim();
    /** The caller's reload: hands back the order the server now holds. */
    const accept = async (ids: string[]) => {
      host.items.set(ids.map((id) => host.items().find((r) => r.id === id)!));
      await fixture.whenStable();
      await fixture.whenStable();
    };
    return { fixture, el, host, button, status, accept };
  }

  it('end buttons stay focusable (aria-disabled, not disabled) and do nothing', async () => {
    const { host, button } = await render();
    const up = button('a', 'up');
    expect(up.disabled).toBe(false);
    expect(up.getAttribute('aria-disabled')).toBe('true');
    up.click();
    expect(host.emitted).toEqual([]);
    expect(button('c', 'down').getAttribute('aria-disabled')).toBe('true');
  });

  it('announces a move only once the new order arrives, and keeps focus on the moved item', async () => {
    const { host, button, status, accept, el } = await render();
    button('b', 'up').focus();
    button('b', 'up').click();
    expect(host.emitted).toEqual([['b', 'a', 'c']]);
    expect(status()).toBe('');

    await accept(['b', 'a', 'c']);
    expect(status()).toBe('نُقل إلى الموضع 1 من 3.');
    // Now at the top: its Up button is aria-disabled but still holds focus.
    expect(document.activeElement).toBe(button('b', 'up'));
    el.remove();
  });

  it('says the order was not saved when the reload brings back the old order', async () => {
    const { host, button, status, accept, el } = await render();
    button('c', 'up').click();
    expect(host.emitted).toEqual([['a', 'c', 'b']]);
    await accept(['a', 'b', 'c']);
    expect(status()).toBe('لم يُحفظ الترتيب.');
    el.remove();
  });

  it('re-announces an identical message on the next move', async () => {
    const { button, status, accept, el, fixture } = await render();
    button('a', 'down').click();
    await accept(['b', 'a', 'c']);
    expect(status()).toBe('نُقل إلى الموضع 2 من 3.');
    button('c', 'up').click();
    // Cleared first, so the same words are spoken again when they come back.
    fixture.detectChanges();
    await accept(['b', 'c', 'a']);
    expect(status()).toBe('نُقل إلى الموضع 2 من 3.');
    el.remove();
  });

  it('ignores moves while busy', async () => {
    const { host, button, fixture, el } = await render();
    host.busy.set(true);
    await fixture.whenStable();
    expect(button('b', 'up').getAttribute('aria-disabled')).toBe('true');
    button('b', 'up').click();
    expect(host.emitted).toEqual([]);
    el.remove();
  });
});
