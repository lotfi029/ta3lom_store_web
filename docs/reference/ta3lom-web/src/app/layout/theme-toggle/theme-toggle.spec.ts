import { TestBed } from '@angular/core/testing';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({ matches: false, addEventListener: () => undefined }),
    });
  });

  function render(locale = 'ar') {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: locale }] });
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    return { fixture, button: fixture.nativeElement.querySelector('button') as HTMLButtonElement };
  }

  it('is a toggle button named «الوضع الداكن», not pressed while the page is light', () => {
    const { button } = render();
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent?.trim()).toBe('الوضع الداكن');
  });

  it('flips to pressed, applies the theme and remembers it', async () => {
    const { fixture, button } = render('en');
    expect(button.textContent?.trim()).toBe('Dark mode');
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('ta-theme')).toBe('dark');
  });
});
