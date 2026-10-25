import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Markdown } from './markdown';

@Component({ imports: [Markdown], template: `<ta-markdown [source]="src()" />` })
class Host {
  readonly src = signal('');
}

describe('<ta-markdown> (C-5)', () => {
  function render(src: string) {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(Host);
    f.componentInstance.src.set(src);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('renders the allowed elements', () => {
    const el = render(
      '## Head\n\nSome **bold** and *em* with [a link](https://ta3lom.sa/x).\n\n- one\n- two\n\n> quote',
    );
    expect(el.querySelector('h2')?.textContent).toBe('Head');
    expect(el.querySelector('strong')?.textContent).toBe('bold');
    expect(el.querySelector('p')?.textContent).toBe('Some bold and em with a link.');
    expect(el.querySelector('em')?.textContent).toBe('em');
    const a = el.querySelector('a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('https://ta3lom.sa/x');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.querySelector('blockquote')?.textContent?.trim()).toBe('quote');
  });

  it('shows HTML in the source as text and never creates script, img or handler attributes', () => {
    const el = render(
      '<script>alert(1)</script><img src=x onerror="alert(1)"> [x](javascript:alert(1))',
    );
    expect(el.querySelector('script, img, iframe')).toBeNull();
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>');
    expect(el.querySelector('[onerror], [onclick], [href^="javascript"]')).toBeNull();
  });
});
