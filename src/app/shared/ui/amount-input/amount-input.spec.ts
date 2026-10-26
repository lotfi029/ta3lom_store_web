import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AmountInput } from './amount-input';

@Component({
  imports: [AmountInput],
  template: `<ta-amount-input
    inputId="amt"
    label="Amount"
    [min]="min()"
    max="100000.00"
    [presets]="presets"
    [(raw)]="raw"
    (amountChange)="amount = $event"
  />`,
})
class Host {
  readonly min = signal<string | null>('10.00');
  readonly raw = signal('');
  readonly presets = ['5.00', '50.00', '100.00'];
  amount: string | null = 'unset';
}

describe('AmountInput', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      el,
      input: el.querySelector('input') as HTMLInputElement,
    };
  }
  const type = (input: HTMLInputElement, v: string) => {
    input.value = v;
    input.dispatchEvent(new Event('input'));
  };

  it('normalises Arabic digits to Western digits on blur and emits the normalised amount', () => {
    const { fixture, host, input } = render();
    type(input, '٧٥٫٥');
    expect(host.amount).toBe('75.50');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('75.5');
    expect(host.raw()).toBe('75.5');
  });

  it('shows the minimum from its input (config / project) only after blur, and emits null', () => {
    const { fixture, host, el, input } = render();
    type(input, '5');
    fixture.detectChanges();
    expect(el.querySelector('.err')?.textContent?.trim()).toBe('');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.amount).toBeNull();
    expect(el.querySelector('.err')?.textContent).toContain('10');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    host.min.set('50.00');
    fixture.detectChanges();
    expect(el.querySelector('.err')?.textContent).toContain('50');
  });

  it('rejects the maximum and malformed amounts', () => {
    const { fixture, host, el, input } = render();
    type(input, '100001');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.amount).toBeNull();
    expect(el.querySelector('.err')?.textContent).toContain('100,000');
    type(input, '1,000');
    fixture.detectChanges();
    expect(host.amount).toBeNull();
  });

  it('offers only the presets within the limits; picking one sets and emits it', () => {
    const { fixture, host, el } = render();
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.preset'));
    expect(buttons.map((b) => b.textContent?.trim())).toHaveLength(2);
    buttons[0].click();
    fixture.detectChanges();
    expect(host.amount).toBe('50.00');
    expect(host.raw()).toBe('50');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('is labelled and its error is described', () => {
    const { el, input } = render();
    expect(el.querySelector('label')?.getAttribute('for')).toBe('amt');
    expect(input.getAttribute('aria-describedby')).toBe('amt-err');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });
});
