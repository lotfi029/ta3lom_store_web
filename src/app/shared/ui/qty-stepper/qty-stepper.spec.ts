import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QtyStepper, clampQuantity } from './qty-stepper';

@Component({
  imports: [QtyStepper],
  template: `<ta-qty-stepper inputId="q" label="Quantity" [max]="max()" [(value)]="qty" />`,
})
class Host {
  readonly max = signal(999);
  readonly qty = signal(1);
}

describe('QtyStepper (D-04)', () => {
  function render(max = 999) {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.max.set(max);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [dec, inc] = Array.from(el.querySelectorAll('button'));
    return {
      fixture,
      host: fixture.componentInstance,
      dec,
      inc,
      input: el.querySelector('input') as HTMLInputElement,
    };
  }

  it('clamps typed values to 1…max, accepting Arabic-Indic digits', () => {
    expect(clampQuantity('٣', 1, 999, 1)).toBe(3);
    expect(clampQuantity('0', 1, 999, 4)).toBe(1);
    expect(clampQuantity('5000', 1, 999, 4)).toBe(999);
    expect(clampQuantity('x', 1, 999, 4)).toBe(4);
  });

  it('steps with the buttons and disables them at the limits', () => {
    const { fixture, host, dec, inc } = render(3);
    expect(dec.disabled).toBe(true);
    inc.click();
    inc.click();
    fixture.detectChanges();
    expect(host.qty()).toBe(3);
    expect(inc.disabled).toBe(true);
    dec.click();
    fixture.detectChanges();
    expect(host.qty()).toBe(2);
  });

  it('a typed value is clamped on change and written back', () => {
    const { fixture, host, input } = render(10);
    input.value = '٢٠';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.qty()).toBe(10);
    expect(input.value).toBe('10');
  });

  it('labels the group, the field and both buttons', () => {
    const { fixture, dec, inc, input } = render();
    const group = (fixture.nativeElement as HTMLElement).querySelector(
      '[role=group]',
    ) as HTMLElement;
    expect(group.getAttribute('aria-labelledby')).toBe('q-l');
    expect(input.getAttribute('aria-label')).toBe('Quantity');
    expect(dec.getAttribute('aria-label')).toBeTruthy();
    expect(inc.getAttribute('aria-label')).toBeTruthy();
  });
});
