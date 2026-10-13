import { Component, LOCALE_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ResourceState } from './resource-state';

/**
 * H3 (admin-dashboard-code-review.md): `httpResource.value()` is `undefined` both while loading
 * and after a failure, so every admin list that did `data.list.value() ?? { items: [] }` showed
 * the SAME "no items yet" message for a genuine 500 as for an empty table — an editor seeing
 * that concludes their content was deleted. This is the test for the shared fix: loading,
 * error and content must be three DISTINCT, DISTINGUISHABLE states.
 */
@Component({
  selector: 'ta-test-host',
  imports: [ResourceState],
  template: `
    <ta-resource-state [loading]="loading()" [error]="error()" (retry)="retried.set(true)">
      <p id="content">real content</p>
    </ta-resource-state>
  `,
})
class TestHost {
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly retried = signal(false);
}

function setup() {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: 'ar' }],
  });
  const fixture = TestBed.createComponent(TestHost);
  fixture.detectChanges();
  return fixture;
}

describe('ResourceState', () => {
  it('shows only the loading state while loading, never the projected content', () => {
    const fixture = setup();
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.state:not(.error)')?.textContent).toContain('جارٍ التحميل');
    expect(el.querySelector('#content')).toBeNull();
  });

  it('shows a distinct error state on failure, never the empty/loading text', () => {
    const fixture = setup();
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.state.error')).not.toBeNull();
    expect(el.querySelector('.state.error')?.textContent).not.toContain('جارٍ التحميل');
    expect(el.querySelector('#content')).toBeNull();
  });

  it('offers a retry action on error that calls back to the resource', () => {
    const fixture = setup();
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.retried()).toBe(true);
  });

  it('renders the projected content only once neither loading nor errored', () => {
    const fixture = setup();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#content')?.textContent).toBe('real content');
    expect(el.querySelector('.state')).toBeNull();
  });

  it('loading takes priority over error if a caller ever manages to set both', () => {
    const fixture = setup();
    fixture.componentInstance.loading.set(true);
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.state.error')).toBeNull();
    expect(el.querySelector('.state')?.textContent).toContain('جارٍ التحميل');
  });
});
