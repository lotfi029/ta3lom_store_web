import {
  Component,
  ElementRef,
  OnDestroy,
  SecurityContext,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import Editor from '@toast-ui/editor';
// Toast UI only registers a locale when its i18n file is explicitly imported — passing
// `language: 'ar'` to the constructor alone silently falls back to English (confirmed by
// rtl-reviewer: i18n.get() has no warning/throw path for an unregistered code). Every stock
// toolbar tooltip and built-in popup (Insert Link, Insert Table) would otherwise render in
// English inside the Arabic build.
import '@toast-ui/editor/dist/i18n/ar';
import { I18nService } from '../../../core/i18n';
import { MediaPickerService } from '../media-picker/media-picker.service';

// ta3lom-api's bodyAr/bodyEn @MaxLength(60000). Exported so every screen that holds its own
// bodyAr/bodyEn signal outside the Signal Forms model (MarkdownEditor's [(value)] two-way binds
// a plain WritableSignal, never a FieldTree) can block submit before the API ever sees an
// over-limit body — the character counter alone was decorative (R4.1,
// admin-dashboard-code-review.md): it turned red past this point and nothing else happened, so a
// long article failed to save with no on-screen reason at all once M2's mapSubmissionError gap
// (now fixed) is also accounted for.
export const MAX_CHARS = 60000;

type ExecCommand = (command: string, payload?: Record<string, unknown>) => void;

/**
 * Toast UI's own stylesheet, loaded on first use instead of imported.
 *
 * It used to be a plain `import '@toast-ui/editor/dist/toastui-editor.css'` at the top of this
 * file. That works under `ng serve` and SILENTLY DOES NOT in a production build:
 * `@angular/build:application` bundles CSS imported from TypeScript into `main-<hash>.css` and
 * then links only the `styles` bundle from index.html, so every build shipped that 167 KB file
 * as an orphan no page ever loaded. The admin editor rendered with base.css's escape-hatch rules
 * and nothing else — the toolbar fell back to `display: block`, its groups stacked into two rows,
 * the sprite icons had no background, and sixteen of the eighteen tools sat behind "more". The
 * failure is invisible in dev, which is why it survived several rounds of toolbar fixes.
 *
 * So it is now a named, NON-injected bundle (angular.json `styles`, `inject: false`), which keeps
 * its `bundleName` unhashed and is fetched here. Non-injected matters: this stylesheet is 105 KB
 * GZIPPED — its icon sprite is a base64 PNG data URI, which does not compress — against a whole
 * public site whose initial transfer is 135 KB. It belongs to one admin screen and must not sit
 * in the render-blocking CSS of every prerendered page.
 *
 * The href is RELATIVE on purpose: it resolves against `<base href>`, which is `/ar/` or `/en/`
 * in a built site and `/` under `ng serve`, so one string is correct in all three.
 */
const STYLESHEET_HREF = 'toastui-editor.css';

let stylesheetLoad: Promise<void> | undefined;

/** Resolves once the stylesheet has actually applied — see `createEditor`'s own note on why the
 *  editor may not be constructed before that happens. Shared across every instance: two editors
 *  render side by side on the posts and programs screens. */
function loadEditorStylesheet(): Promise<void> {
  stylesheetLoad ??= new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLESHEET_HREF;
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => {
      // Report and carry on: an unstyled editor still edits, and refusing to mount one would
      // turn a missing file into a blank screen. Loud because the unstyled state is otherwise
      // easy to mistake for a layout bug — which is exactly what happened before this existed.
      console.error(`markdown-editor: ${STYLESHEET_HREF} failed to load; the editor will render unstyled.`);
      resolve();
    }, { once: true });
    document.head.appendChild(link);
  });
  return stylesheetLoad;
}

/**
 * FR-18 / ADR-008. Toast UI Editor, per the Part 2 RTL trial (see the Part 2 commit message for
 * the full evidence — cursor placement, mid-string insertion and mixed Arabic/English text all
 * tested clean in both Toast UI and Milkdown; Toast UI won on a ready-made, configurable
 * toolbar and a WYSIWYG/Markdown toggle that directly serves أ. ريم's "no code editor" need).
 *
 * The live preview does NOT use Toast UI's own built-in preview pane — that pane is Toast UI's
 * own CSS, not the public site's `.prose` styling the requirement asks for. Instead the
 * built-in preview is hidden (`previewStyle: 'tab'`, only the write tab exposed) and this
 * component renders its own `.prose`-styled preview from the hidden pane's HTML, bound via a plain
 * `[innerHTML]` on a STRING — never `bypassSecurityTrustHtml` (non-negotiable #11, lint-banned).
 * Angular's own sanitiser cleans it on the way in, exactly as ADR-008 describes for the public
 * site's `bodyArHtml` binding ("Angular sanitises again on binding — a third layer, free") —
 * appropriate here because the source is the signed-in editor's own typing, not attacker input,
 * and the API's write-time sanitisation remains the real security boundary once this is saved.
 *
 * Toolbar: h2, h3, bold, italic, list, ordered list, link, quote, table, image — NO h1 (the
 * page owns its single h1). Toast UI's stock "heading" button is an h1-h6 popup; two custom
 * buttons replace it, each a real `el` wired in `onMounted` to `execCommand('heading', {level})`.
 * The image button is simpler still — it never touches Toast UI's command system at all, just
 * opens the shared media picker and inserts the markdown directly.
 */
@Component({
  selector: 'ta-markdown-editor',
  templateUrl: './markdown-editor.html',
  styleUrl: './markdown-editor.css',
})
export class MarkdownEditor implements OnDestroy {
  readonly value = model.required<string>();
  readonly label = input.required<string>();
  readonly hint = input<string>();

  private readonly editorHost = viewChild.required<ElementRef<HTMLElement>>('editorHost');
  private readonly picker = inject(MediaPickerService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly i18n = inject(I18nService);

  protected readonly previewHtml = signal('');
  protected readonly charCount = signal(0);
  protected readonly charLimit = MAX_CHARS;
  protected readonly overLimit = signal(false);

  private editor?: Editor;
  private toolbarObserver?: MutationObserver;
  private applyingExternalValue = false;
  private destroyed = false;

  constructor() {
    // Signal Forms / a parent form-reset can set `value` from outside — sync it into the
    // editor without re-triggering our own `change` handler (which would otherwise fight the
    // external write on every keystroke it did NOT originate).
    effect(() => {
      const external = this.value();
      if (this.editor && this.editor.getMarkdown() !== external) {
        this.applyingExternalValue = true;
        this.editor.setMarkdown(external, false);
        this.applyingExternalValue = false;
        this.updatePreview();
      }
    });

    // afterNextRender, NOT ngAfterViewInit — and it is the toolbar that forces the choice, not
    // just the fact that afterNextRender is browser-only (which conveniently replaces the old
    // isPlatformBrowser guard: it never runs during prerendering).
    //
    // Toast UI measures every toolbar button ONCE, as it mounts, and caches the widths forever —
    // no resize recomputes them. A button that is hidden at that moment is not measured at all;
    // the library substitutes a flat 80px guess. Constructing the editor in ngAfterViewInit ran
    // it before the browser had laid this component's grid out, so the toolbar was still one
    // column wide, most tools started life in the overflow dropdown, and each was cached at the
    // 80px guess instead of its real 56px — leaving six tools stranded behind "more" on a
    // toolbar with room for all eighteen. Waiting for the render to finish means the first
    // measurement is taken against the real full-width toolbar.
    afterNextRender(() => void this.createEditor());
  }

  private async createEditor(): Promise<void> {
    // AWAITED, not fire-and-forget. Toast UI measures every toolbar button once as it mounts and
    // caches the widths forever (see the afterNextRender note above); constructing it before its
    // own stylesheet applies means measuring unstyled buttons, which is the same defect in a
    // different disguise — and it is what the missing stylesheet used to cause on every load.
    await loadEditorStylesheet();
    // The form can be cancelled while the stylesheet is in flight.
    if (this.destroyed) return;

    this.editor = new Editor({
      el: this.editorHost().nativeElement,
      // 'auto', not a pixel height, and the reason is layout rather than sizing. The prototype's
      // editor is one card with a full-width toolbar above a writing area and live preview side
      // by side (its .md-wrap/.md-bar/.md-split). Toast UI's toolbar and writing area are nested
      // inside this host, a level below the preview's parent, so base.css flattens the wrappers
      // with `display: contents` to place all four in one grid. A fixed height makes the library
      // stamp `display: flex` on the root through a `:not(.auto-height) > …` rule that ties with
      // ours on specificity and wins on order; `height: 'auto'` adds the `auto-height` class the
      // rule excludes, which is the library's own supported way out. The writing area's height
      // then comes from base.css instead.
      height: 'auto',
      initialEditType: 'markdown',
      previewStyle: 'tab',
      hideModeSwitch: true,
      initialValue: this.value(),
      // Toast UI's own default is `true`, and it focuses the editor as it mounts — which the
      // browser answers by scrolling that editor into view. Inside a dialog the editors sit near
      // the bottom of a long form, and this component mounts asynchronously (the awaited
      // stylesheet above), so the focus landed AFTER showModal() had already focused the first
      // field: every form with a body editor opened scrolled two-thirds of the way down, past its
      // own title. With two editors on a screen the second one won, so the form opened on the
      // English body. Nothing here wants focus on mount — the dialog's own first field does.
      autofocus: false,
      usageStatistics: false,
      // Toast UI's default HTML sanitiser is a copy of DOMPurify 2.3.3 BUNDLED into its own
      // dist/esm/index.js — not the npm `dompurify` package — so updating that package (see the
      // `overrides` entry in package.json, which exists for the dependency scanner) does not
      // change what runs here. 2.3.3 carries GHSA-vhxf-7vqr-mrjg (XSS) and GHSA-h7mw-gpvr-xq4m.
      // Angular's own sanitiser takes its place for the Markdown preview pane — the one the public
      // site already relies on for `bodyArHtml`. It does NOT reach the bundled copy's other call
      // sites, which all sit on the Markdown → WYSIWYG conversion path; that is why this
      // component never calls editor.getHTML() (see updatePreview) and why WYSIWYG stays off
      // (initialEditType 'markdown', hideModeSwitch).
      customHTMLSanitizer: (html: string) => this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '',
      language: this.i18n.locale === 'ar' ? 'ar' : 'en',
      // Every tool here is one the API's Markdown sanitiser actually keeps — checked against
      // ALLOWED_TAGS in ta3lom-api's common/markdown/sanitise.ts rather than assumed, because a
      // button whose output is stripped on write silently eats the editor's work.
      //   included: h2/h3/h4 (allowed), bold/italic (strong/em), strike (del), quote
      //             (blockquote), ul/ol + indent/outdent (ul/ol/li), code + codeblock
      //             (code/pre), hr, link (a), table, image (img)
      //   excluded: the stock `heading` popup — it offers h1, and the page owns its only h1
      //             (non-negotiable #14), which is why the single-level buttons below exist
      //   excluded: `task` — GFM task lists render <input type="checkbox">, and `input` is NOT
      //             in the allow-list, so every checkbox would vanish on save
      // BOTH the order and the grouping are load-bearing, not taste. Toast UI walks this list in
      // order, budgeting the toolbar's clientWidth minus 50, and moves everything past the line
      // into a "more" dropdown — 56px per button (46px plus its 5px side margins) and, the part
      // that is easy to miss, 25px for every divider BETWEEN groups. Seven groups spent 150px of
      // divider — nearly three buttons' worth — which is why these are five: each group merged
      // buys back a tool that would otherwise be hidden.
      //
      // The order then sorts by how often أ. ريم actually reaches for each tool, so that what
      // overflows on a narrow screen is what a Media Centre officer writing news wants least.
      // Measured: at 1500px all eighteen fit with no dropdown at all; at 1366px twelve stay
      // visible and only the rule and the two code tools drop behind "more".
      toolbarItems: [
        [
          this.headingButton(2, this.i18n.pick('عنوان', 'Heading')),
          this.headingButton(3, this.i18n.pick('عنوان فرعي', 'Subheading')),
          this.headingButton(4, this.i18n.pick('عنوان فرعي صغير', 'Minor subheading')),
        ],
        ['bold', 'italic', 'strike'],
        ['ul', 'ol', 'quote'],
        ['link', this.imageButton(), 'table'],
        ['indent', 'outdent', 'hr', 'code', 'codeblock'],
      ],
      events: {
        change: () => this.onEditorChange(),
      },
    });
    // The hidden preview pane re-renders on every edit; follow it rather than the `change` event
    // alone, whose order relative to the pane's update is not documented. Registered with on()
    // because the library emits this event but its EventMap typings omit it.
    this.editor.on('afterPreviewRender', () => this.updatePreview());

    // previewStyle: 'tab' is required to suppress Toast UI's side-by-side preview (which uses
    // its own CSS, not the public site's .prose the requirement asks for) — but it still shows
    // a "Write / Preview" tab switcher, and its Preview tab would show that same unwanted CSS.
    // There is no "no preview at all" previewStyle, so the tab switcher itself is hidden here,
    // leaving Write as the only reachable mode; this component's own .prose pane is the preview.
    //
    // HIDDEN, not removed: Toast UI still holds a reference to this node, and its own destroy()
    // walks that tree calling removeChild. Detaching the node behind its back made teardown
    // throw NotFoundError out of ngOnDestroy every time an editor form closed, which aborts
    // Angular's view destruction midway and leaves the DOM in a broken state.
    const tabContainer = this.editorHost().nativeElement.querySelector<HTMLElement>('.toastui-editor-md-tab-container');
    if (tabContainer) tabContainer.style.display = 'none';

    this.nameOverflowButton();
    this.updatePreview();
  }

  /**
   * Toast UI gives every toolbar tool an `aria-label` from its i18n bundle — verified in the
   * browser, all eighteen read correctly in Arabic — but the overflow ("more") button it builds
   * itself has no accessible name at all: no aria-label, no title, no text, just a CSS sprite.
   * A screen-reader user hears "button", and the three tools behind it are unreachable in
   * practice. That is exactly audit finding F-18, so it gets named here.
   *
   * Via MutationObserver rather than a one-off assignment because Toast UI re-runs its overflow
   * calculation on resize and re-renders the toolbar's children when the split changes, throwing
   * away whatever attribute we set on the previous button instance.
   */
  private nameOverflowButton(): void {
    const toolbar = this.editorHost().nativeElement.querySelector<HTMLElement>('.toastui-editor-defaultUI-toolbar');
    if (!toolbar) return;

    const label = this.i18n.pick('أدوات إضافية', 'More tools');
    const apply = () => {
      const more = toolbar.querySelector<HTMLElement>('button.more');
      if (more && more.getAttribute('aria-label') !== label) more.setAttribute('aria-label', label);
    };

    apply();
    this.toolbarObserver = new MutationObserver(apply);
    this.toolbarObserver.observe(toolbar, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    // Set BEFORE editor.destroy(): the library fires one last change event from inside it.
    this.destroyed = true;
    this.toolbarObserver?.disconnect();
    // A third-party widget failing to tear itself down must never take Angular's own view
    // destruction with it — that is what turns one editor's teardown into a broken page.
    try {
      this.editor?.destroy();
    } catch {
      // Toast UI could not clean up its own DOM; Angular is about to remove the host element
      // anyway, so there is nothing left to salvage and nothing useful to report.
    }
  }

  /** Toast UI's stock "heading" toolbar item is an h1-h6 popup — building single-level buttons
   *  instead is the only way to offer h2/h3/h4 without h1 on the toolbar. h4 is the deepest
   *  level the API's sanitiser keeps. */
  private headingButton(level: 2 | 3 | 4, tooltip: string) {
    // A real DOM node created imperatively for Toast UI's own toolbar — never rendered by
    // Angular's template compiler, so it carries no _ngcontent scoping attribute and a normal
    // component stylesheet rule could never reach it (the same reason base.css keeps a few
    // global escape-hatch rules — see its own comment on .rtl-mirror). Sizing is NOT set
    // inline here: Toast UI's own default toolbar buttons are 32x32px, under the project's
    // 44x44px minimum (non-negotiable #7) — base.css has a global rule raising every toolbar
    // button (stock and custom alike) to 44px, since scoped CSS can't reach this DOM either way.
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'toastui-editor-toolbar-icons';
    el.textContent = `H${level}`;
    el.setAttribute('aria-label', tooltip);
    Object.assign(el.style, {
      fontFamily: 'var(--fe)',
      fontSize: '0.75rem',
      fontWeight: '700',
      backgroundImage: 'none',
    });
    return {
      name: `heading-h${level}`,
      tooltip,
      el,
      onMounted: (execCommand: ExecCommand) => {
        el.addEventListener('click', () => execCommand('heading', { level }));
      },
    };
  }

  private imageButton() {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'toastui-editor-toolbar-icons image';
    el.setAttribute('aria-label', this.i18n.pick('إدراج صورة', 'Insert image'));
    el.addEventListener('click', () => {
      void this.onInsertImage();
    });
    return {
      name: 'image-picker',
      tooltip: this.i18n.pick('إدراج صورة', 'Insert image'),
      el,
    };
  }

  private onEditorChange(): void {
    // `destroyed` first: Toast UI emits a final `change` from inside its own destroy(), and by
    // then Angular has already torn down this component's `value` model — writing to it logs
    // "NG0953: Unexpected emit for destroyed OutputRef" on every cancel or save that closes an
    // editor form. The value is on its way out with the component, so there is nothing to keep.
    if (this.destroyed || this.applyingExternalValue || !this.editor) return;
    this.value.set(this.editor.getMarkdown());
    this.updatePreview();
  }

  /** Single source of truth for the preview pane AND the character count — called on init, on
   *  every user edit, and whenever `value` is set from outside (the constructor's effect). */
  private updatePreview(): void {
    const markdown = this.editor?.getMarkdown() ?? '';
    // From Toast UI's own (hidden) Markdown preview pane, which renders through
    // customHTMLSanitizer — i.e. Angular's sanitiser. NOT editor.getHTML(): that converts the
    // Markdown into the WYSIWYG model, and the converter sanitises raw HTML with the DOMPurify
    // 2.3.3 bundled inside Toast UI (GHSA-vhxf-7vqr-mrjg), assigning the result to innerHTML.
    // Plain string, bound via [innerHTML] in the template — Angular sanitises it again on the way
    // in. Never bypassSecurityTrustHtml (non-negotiable #11).
    const pane = this.editor?.getEditorElements().mdPreview.querySelector('.toastui-editor-contents');
    this.previewHtml.set(pane?.innerHTML ?? '');
    this.charCount.set(markdown.length);
    this.overLimit.set(markdown.length > MAX_CHARS);
  }

  private async onInsertImage(): Promise<void> {
    const asset = await this.picker.pick({ filter: 'image' });
    if (!asset || !this.editor) return;
    const alt = (asset.altAr ?? '').replace(/[[\]]/g, '');
    this.editor.insertText(`![${alt}](${asset.url})`);
    this.onEditorChange();
  }
}
