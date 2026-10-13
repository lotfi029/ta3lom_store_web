import { Component, SecurityContext, provideZonelessChangeDetection, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

/**
 * Toast UI's stylesheet used to be a plain `import '@toast-ui/editor/dist/toastui-editor.css'`
 * in markdown-editor.ts. That works under `ng serve` and silently does not in a production
 * build — @angular/build:application bundled it into `main-<hash>.css`, which index.html never
 * linked, so every release shipped the file as an orphan and the editor rendered with none of
 * its own CSS: toolbar `display: block` instead of flex, no sprite icons, sixteen of eighteen
 * tools stranded behind "more".
 *
 * The component now fetches it itself. This is the regression test for that: the failure was
 * invisible in dev and in the test suite alike, and a future refactor that "tidies" the loader
 * back into an import would reintroduce it with every check still green.
 *
 * The BUILD half of the same fix — that `toastui-editor.css` is emitted, and is NOT linked from
 * index.html — is guarded in scripts/check-bundle-budget.mjs, which is the only place that can
 * see build output at all.
 */
@Component({
  selector: 'ta-test-host',
  imports: [MarkdownEditor],
  template: `<ta-markdown-editor [(value)]="body" label="Body" />`,
})
class TestHost {
  readonly body = signal('');
}

describe('MarkdownEditor stylesheet', () => {
  it('loads the editor stylesheet itself rather than relying on a bundler CSS import', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const link = document.head.querySelector('link[rel="stylesheet"][href="toastui-editor.css"]');
    expect(link).not.toBeNull();
  });
});

/**
 * Toast UI ships its own copy of DOMPurify 2.3.3 inside dist/esm/index.js (GHSA-vhxf-7vqr-mrjg,
 * GHSA-h7mw-gpvr-xq4m), so the editor is handed Angular's sanitiser instead (customHTMLSanitizer).
 * These check the EDITOR's own output — getHTML() and its hidden preview pane — not our
 * `.prose` preview, whose [innerHTML] binding would strip the same things either way and so
 * could not tell the two sanitisers apart.
 */
describe('MarkdownEditor HTML sanitising', () => {
  const HOSTILE = [
    '**bold**',
    '',
    '<img src="x" onerror="alert(1)">',
    '',
    '<script>alert(2)</script>',
    '',
    '<a href="javascript:alert(3)">link</a>',
  ].join('\n');

  let fixtureTick: () => void = () => undefined;

  async function mount() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const sanitize = vi.spyOn(TestBed.inject(DomSanitizer), 'sanitize');
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.body.set(HOSTILE);
    fixture.detectChanges();
    await fixture.whenStable();
    // jsdom never fetches stylesheets; let the editor's awaited load resolve.
    document.head.querySelector('link[href="toastui-editor.css"]')?.dispatchEvent(new Event('load'));
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
    fixtureTick = () => fixture.detectChanges();
    const editor = fixture.debugElement.children[0].componentInstance as unknown as { editor?: { getHTML(): string } };
    return { fixture, sanitize, editor: editor.editor, el: fixture.nativeElement as HTMLElement };
  }

  it("the preview comes from the pane Angular's sanitiser rendered, never from getHTML()", async () => {
    const { editor, sanitize, el } = await mount();
    expect(editor).toBeDefined();
    // The raw HTML in the Markdown was handed to Angular's sanitiser (customHTMLSanitizer)…
    expect(sanitize).toHaveBeenCalledWith(SecurityContext.HTML, expect.stringMatching(/onerror/i));
    // …and getHTML(), whose WYSIWYG conversion uses the bundled DOMPurify 2.3.3, is never called.
    const getHTML = vi.spyOn(editor as { getHTML(): string }, 'getHTML');
    const preview = el.querySelector('.md-preview, .prose') as HTMLElement | null;
    expect(preview?.innerHTML).toContain('<strong>bold</strong>');
    expect(preview?.innerHTML ?? '').not.toMatch(/onerror|<script/i);
    // Angular neutralises a javascript: URL by prefixing it `unsafe:` — inert, never executable.
    for (const a of Array.from(preview?.querySelectorAll('a') ?? [])) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
    }
    fixtureTick();
    expect(getHTML).not.toHaveBeenCalled();
  });

  it('nothing executable reaches the DOM, including the hidden Toast UI preview pane', async () => {
    const { el } = await mount();
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();
    expect(el.querySelector('a[href^="javascript:"]')).toBeNull();
  });
});
