import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

type Listener = (event: { matches: boolean }) => void;

function fakeMatchMedia(initial: boolean) {
  const listeners: Listener[] = [];
  const query = {
    matches: initial,
    addEventListener: (_: string, l: Listener) => listeners.push(l),
  };
  // jsdom has no matchMedia at all, so it is defined rather than spied on.
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => query as unknown as MediaQueryList });
  return (matches: boolean) => listeners.forEach((l) => l({ matches }));
}

function setup(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: PLATFORM_ID, useValue: platform }],
  });
  const service = TestBed.inject(ThemeService);
  TestBed.tick();
  return service;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => vi.restoreAllMocks());

  it('defaults to following the system, and applies it to <html>', () => {
    fakeMatchMedia(true);
    const service = setup();
    expect(service.preference()).toBe('system');
    expect(service.effective()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows a live change of the OS setting while the preference is system', () => {
    const change = fakeMatchMedia(false);
    const service = setup();
    expect(service.effective()).toBe('light');
    change(true);
    TestBed.tick();
    expect(service.effective()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('an explicit choice wins over the OS, persists, and survives a reload', () => {
    const change = fakeMatchMedia(true);
    const service = setup();
    service.toggle(); // dark → light, pinned
    TestBed.tick();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    change(true);
    TestBed.tick();
    expect(service.effective()).toBe('light');

    TestBed.resetTestingModule();
    fakeMatchMedia(true);
    expect(setup().preference()).toBe('light');
  });

  it('going back to system forgets the stored choice', () => {
    fakeMatchMedia(false);
    const service = setup();
    service.set('dark');
    service.set('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('ignores a garbage stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '<script>');
    fakeMatchMedia(false);
    expect(setup().preference()).toBe('system');
  });

  it('keeps working when storage throws (private mode)', () => {
    fakeMatchMedia(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const service = setup();
    expect(service.preference()).toBe('system');
    expect(() => service.set('dark')).not.toThrow();
    TestBed.tick();
    expect(service.effective()).toBe('dark');
  });

  it('touches neither storage nor the document on the server (prerender)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const service = setup('server');
    expect(getItem).not.toHaveBeenCalled();
    expect(service.effective()).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
