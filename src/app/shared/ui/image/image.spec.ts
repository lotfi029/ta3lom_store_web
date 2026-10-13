import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Image } from './image';

/**
 * CLAUDE.md non-negotiable #6 / F-17: `alt` is a required input, not a convention. The old site
 * had 53 of 72 images with no alt text; this is the structural fix — omitting `alt` must fail,
 * not silently render an image with no accessible name.
 */
describe('Image', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.createComponent(Image);
  }

  it('throws when alt is never provided (required input enforcement)', () => {
    const fixture = setup();
    fixture.componentRef.setInput('src', '/media/abc/file');
    fixture.componentRef.setInput('width', 640);
    fixture.componentRef.setInput('height', 360);
    // alt deliberately not set.
    expect(() => fixture.detectChanges()).toThrow();
  });

  it('renders the given alt text on the underlying img element', () => {
    const fixture = setup();
    fixture.componentRef.setInput('src', '/media/abc/file');
    fixture.componentRef.setInput('alt', 'طلاب في المختبر');
    fixture.componentRef.setInput('width', 640);
    fixture.componentRef.setInput('height', 360);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('alt')).toBe('طلاب في المختبر');
  });
});
