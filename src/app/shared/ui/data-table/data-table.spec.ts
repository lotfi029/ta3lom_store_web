import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DataTable, PagedData } from './data-table';

interface Row {
  id: string;
  name: string;
}

/**
 * H2 (admin-dashboard-code-review.md): the pager rendered, was clickable, and did nothing — no
 * screen bound `(pageChange)`. This is the regression test for the shared component's OWN half
 * of that fix: it must actually emit the right target page, and the Prev/Next buttons must
 * disable at the real boundaries computed from the API's own `total`/`size` — not the caller's
 * page-1 fallback envelope, which every Pattern-A screen used to pass while loading.
 */
@Component({
  selector: 'ta-test-host',
  imports: [DataTable],
  template: `
    <ta-data-table [data]="data()" caption="Test table" (pageChange)="lastPageChange.set($event)">
      <ng-template #row let-item>
        <td>{{ item.name }}</td>
      </ng-template>
    </ta-data-table>
  `,
})
class TestHost {
  readonly data = signal<PagedData<Row>>({
    items: [{ id: 'a', name: 'A' }],
    total: 3,
    page: 1,
    pageSize: 1,
  });
  readonly lastPageChange = signal<number | null>(null);
}

function setup() {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(TestHost);
  fixture.detectChanges();
  return fixture;
}

describe('DataTable pagination', () => {
  it('emits page + 1 when Next is clicked', () => {
    const fixture = setup();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.pager-btn'),
    );
    const next = buttons[1];

    next.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.lastPageChange()).toBe(2);
  });

  it('emits page - 1 when Prev is clicked', () => {
    const fixture = setup();
    fixture.componentInstance.data.set({
      items: [{ id: 'b', name: 'B' }],
      total: 3,
      page: 2,
      pageSize: 1,
    });
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.pager-btn'),
    );
    buttons[0].click(); // Prev
    fixture.detectChanges();

    expect(fixture.componentInstance.lastPageChange()).toBe(1);
  });

  it('disables Prev on page 1 and Next on the last page', () => {
    const fixture = setup(); // page 1 of 3
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.pager-btn'),
    );
    expect(buttons[0].disabled).toBe(true); // Prev
    expect(buttons[1].disabled).toBe(false); // Next

    fixture.componentInstance.data.set({
      items: [{ id: 'c', name: 'C' }],
      total: 3,
      page: 3,
      pageSize: 1,
    });
    fixture.detectChanges();
    const buttonsAtEnd: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.pager-btn'),
    );
    expect(buttonsAtEnd[0].disabled).toBe(false); // Prev
    expect(buttonsAtEnd[1].disabled).toBe(true); // Next
  });

  it('falls back to a coherent page count instead of Infinity when size is 0', () => {
    const fixture = setup();
    fixture.componentInstance.data.set({
      items: [{ id: 'd', name: 'D' }],
      total: 5,
      page: 1,
      pageSize: 0,
    });
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.pager-status');
    expect(status.textContent).not.toContain('Infinity');
  });
});

/** `T extends { id: string }` (M6) — `track item.id` must not throw for a normal id-bearing row
 *  type; this is effectively a compile-time guarantee (see data-table.ts's own comment), so the
 *  runtime assertion here is just that rendering with a real id succeeds without error. */
describe('DataTable row identity', () => {
  it('renders rows keyed by id without throwing', () => {
    const fixture = setup();
    const cells = fixture.nativeElement.querySelectorAll('td');
    expect(cells.length).toBe(1);
    expect(cells[0].textContent).toBe('A');
  });
});
