import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';

@Component({
  imports: [Button],
  template: `
    <form (submit)="submitted = submitted + 1; $event.preventDefault()">
      <ta-button type="submit" [loading]="loading()">Save changes</ta-button>
    </form>
  `,
})
class Host {
  readonly loading = signal(false);
  submitted = 0;
}

describe('Button', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, host: fixture.componentInstance, button };
  }

  it('is a plain, idle button by default', () => {
    const { button } = render();
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(button.querySelector('.spinner')).toBeNull();
    expect(button.querySelector('.label')?.textContent?.trim()).toBe('Save changes');
  });

  it('while loading: aria-busy, a spinner, the label kept in layout, and presses swallowed', async () => {
    const { fixture, host, button } = render();
    button.click();
    expect(host.submitted).toBe(1);

    host.loading.set(true);
    await fixture.whenStable();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.querySelector('.spinner')).not.toBeNull();
    // Still there (visibility: hidden in CSS), so the button keeps the label's width.
    expect(button.querySelector('.label')?.textContent?.trim()).toBe('Save changes');

    button.click();
    expect(host.submitted).toBe(1);
  });

  it('keeps focus while loading — not the native disabled, which would drop it to <body>', async () => {
    const { fixture, host, button } = render();
    button.focus();
    host.loading.set(true);
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });
});
