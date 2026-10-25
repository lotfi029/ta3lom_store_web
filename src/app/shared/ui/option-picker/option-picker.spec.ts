import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OPEN_AMOUNT, OptionPicker, type PickerOption } from './option-picker';

@Component({
  imports: [OptionPicker],
  template: `<ta-option-picker
    name="opt"
    legend="Choose"
    [options]="options"
    [allowOpen]="allowOpen()"
    [(selected)]="selected"
  />`,
})
class Host {
  readonly options: PickerOption[] = [
    { id: 'a', label: 'One day', amount: '100.00' },
    { id: 'b', label: 'One week', amount: '500.00' },
  ];
  readonly allowOpen = signal(true);
  readonly selected = signal<string | null>(null);
}

describe('OptionPicker (D-W5)', () => {
  function render(allowOpen = true) {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.allowOpen.set(allowOpen);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      el,
      radios: () => Array.from(el.querySelectorAll<HTMLInputElement>('input[type=radio]')),
    };
  }

  it('renders one radio per option with its price, plus "open amount" when allowed', () => {
    const { el, radios } = render();
    expect(radios()).toHaveLength(3);
    expect(el.textContent).toContain('One day');
    expect(el.textContent).toContain('100');
    expect(radios().every((r) => r.name === 'opt')).toBe(true);
    expect(el.querySelector('legend')?.textContent).toBe('Choose');
  });

  it('has no open-amount chip when the project does not allow it', () => {
    expect(render(false).radios()).toHaveLength(2);
  });

  it('selects an option or the open amount', () => {
    const { fixture, host, radios, el } = render();
    radios()[1].click();
    fixture.detectChanges();
    expect(host.selected()).toBe('b');
    expect(el.querySelectorAll('.chip.on')).toHaveLength(1);
    radios()[2].click();
    fixture.detectChanges();
    expect(host.selected()).toBe(OPEN_AMOUNT);
  });
});
