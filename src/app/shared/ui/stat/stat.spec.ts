import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stat } from './stat';

describe('Stat', () => {
  afterEach(() => vi.unstubAllGlobals());

  function render(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Stat);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a managed figure as typed and never starts the count-up', async () => {
    const observe = vi.fn();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observe;
        disconnect = vi.fn();
      },
    );
    const fixture = render({ text: '43K', label: 'مستفيد' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.num').textContent.trim()).toBe('43K');
    expect(observe).not.toHaveBeenCalled();
  });

  it('jumps to the number under reduced motion when no text is given', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const fixture = render({ value: 1200, suffix: '+', label: 'x' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.num').textContent.trim()).toBe('1200+');
  });
});
