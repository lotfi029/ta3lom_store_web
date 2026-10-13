import { LOCALE_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminAsset, AdminMediaData } from '../../../core/admin-media.data';
import { PagedData } from '../../../core/paged-data';
import { MediaLibrary } from './media-library';

/**
 * Regression test for the "delete button is invisible" bug: shared/ui/media-library reused the
 * class name `tile` for its asset grid, and src/styles/base.css already owns a GLOBAL `.tile`
 * rule (16:9 aspect-ratio + overflow: hidden) for the public video/article posters. Component
 * styles only override the properties they redeclare, so every asset tile inherited that
 * aspect-ratio and had its caption plus its Alt-text/Delete action row clipped by the inherited
 * `overflow: hidden` — the buttons were in the DOM and wired up, just invisible and unclickable.
 * The fix renamed the family to `asset-tile`/`asset-tile-main`/`asset-tile-actions`. This test
 * pins both halves: the actions are actually rendered, AND the collision-prone bare `tile` class
 * is gone, so a future edit here can't quietly reintroduce it.
 */
const IMAGE_ASSET: AdminAsset = {
  id: 'asset-1',
  kind: 'image',
  url: 'https://cdn.example.com/asset-1.jpg',
  externalId: null,
  altAr: 'صورة',
  altEn: 'photo',
  width: 800,
  height: 600,
  mime: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 123_456,
  uploadedBy: 'editor@ta3lom.sa',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const PDF_ASSET: AdminAsset = {
  id: 'asset-2',
  kind: 'pdf',
  url: 'https://cdn.example.com/asset-2.pdf',
  externalId: null,
  altAr: null,
  altEn: null,
  width: null,
  height: null,
  mime: 'application/pdf',
  originalName: 'report.pdf',
  sizeBytes: 654_321,
  uploadedBy: null,
  createdAt: '2026-01-02T00:00:00.000Z',
};

function stubData(assets: AdminAsset[]) {
  const page: PagedData<AdminAsset> = { items: assets, total: assets.length, page: 1, size: 24 };
  return {
    kindFilter: signal<'image' | 'pdf' | 'youtube' | null>(null),
    missingAltOnly: signal(false),
    page: signal(1),
    list: {
      isLoading: signal(false),
      error: signal<unknown>(undefined),
      value: signal<PagedData<AdminAsset> | undefined>(page),
      reload: vi.fn(),
    },
    getReferences: vi.fn().mockResolvedValue({ assetId: '', total: 0, references: [] }),
    remove: vi.fn(),
    fileDownloadUrl: (id: string) => `https://api.example.test/media/${id}/file?download=1`,
    filePreviewUrl: (id: string) => `https://api.example.test/media/${id}/file`,
  };
}

function setup(assets: AdminAsset[], pickerMode = false) {
  const adminMediaData = stubData(assets);

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: LOCALE_ID, useValue: 'ar' },
      { provide: AdminMediaData, useValue: adminMediaData },
    ],
  });

  const fixture = TestBed.createComponent(MediaLibrary);
  if (pickerMode) fixture.componentRef.setInput('pickerMode', true);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

/** Every `<dialog>` in the fixture that currently has the native `open` attribute — including
 *  the one inside the nested `<ta-asset-preview>`, which renders its own `ta-dialog`. */
function openDialogs(el: HTMLElement): HTMLDialogElement[] {
  return Array.from(el.querySelectorAll('dialog')).filter((d) => d.hasAttribute('open'));
}

function clickButton(fixture: ComponentFixture<MediaLibrary>, text: string): void {
  const el = fixture.nativeElement as HTMLElement;
  const button = Array.from(el.querySelectorAll<HTMLButtonElement>('.asset-tile-actions button')).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!button) throw new Error(`No action button with text "${text}"`);
  button.click();
  fixture.detectChanges();
}

/** Clicks the tile itself — the whole-tile "View" affordance, not a separate button. */
function clickTile(fixture: ComponentFixture<MediaLibrary>): void {
  const el = fixture.nativeElement as HTMLElement;
  const tile = el.querySelector<HTMLButtonElement>('.asset-tile-main');
  if (!tile) throw new Error('No .asset-tile-main button found');
  tile.click();
  fixture.detectChanges();
}

describe('MediaLibrary — asset tile actions', () => {
  it('renders only Alt text and Delete in the action row for an image, in library mode', () => {
    const { el } = setup([IMAGE_ASSET]);

    const buttons = Array.from(el.querySelectorAll('.asset-tile-actions button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['النص البديل', 'حذف']);
  });

  it('renders only Delete in the action row for a non-image asset', () => {
    const { el } = setup([PDF_ASSET]);

    const buttons = Array.from(el.querySelectorAll('.asset-tile-actions button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['حذف']);
  });

  it('renders the tile itself as a button labelled with the View action, in library mode', () => {
    const { el } = setup([PDF_ASSET]);

    const tile = el.querySelector<HTMLButtonElement>('.asset-tile-main');
    expect(tile?.tagName).toBe('BUTTON');
    expect(tile?.getAttribute('aria-label')).toBe('عرض PDF — report.pdf');
  });

  it('never uses the bare "tile" class, which collides with the global public-tile styles', () => {
    const { el } = setup([IMAGE_ASSET, PDF_ASSET]);

    const withBareTile = Array.from(el.querySelectorAll('*')).filter((node) => node.classList.contains('tile'));
    expect(withBareTile).toEqual([]);
    // The renamed family should still be present, so this isn't just an empty grid.
    expect(el.querySelector('.asset-tile')).not.toBeNull();
    expect(el.querySelector('.asset-tile-main')).not.toBeNull();
    expect(el.querySelector('.asset-tile-actions')).not.toBeNull();
  });

  it('does not render an action row at all in picker mode', () => {
    const { el } = setup([IMAGE_ASSET], true);
    expect(el.querySelector('.asset-tile-actions')).toBeNull();
  });
});

describe('MediaLibrary — asset preview', () => {
  it('opens the preview dialog when the tile itself is clicked, showing the real filename', () => {
    const { fixture, el } = setup([PDF_ASSET]);

    clickTile(fixture);

    const dialogs = openDialogs(el);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].textContent).toContain('report.pdf');
  });

  /**
   * The preview is a fourth dialog alongside alt/delete/references, each backed by a real
   * `showModal()` — media-library.ts documents these as mutually exclusive by construction.
   * Unlike a real browser, jsdom's polyfilled `<dialog>` (test-setup.ts) does not itself stop a
   * second `showModal()` from opening while the DOM still shows a first one `open` — so this
   * guards the app's OWN bookkeeping (openPreview clearing pendingAltAsset/deleteTarget/
   * deleteReferences, and the Alt text / Delete triggers clearing previewAsset), not a browser
   * guarantee.
   */
  it('closes the preview when Alt text is opened afterwards', () => {
    const { fixture, el } = setup([IMAGE_ASSET]);

    clickTile(fixture);
    expect(openDialogs(el)).toHaveLength(1);

    clickButton(fixture, 'النص البديل');

    const dialogs = openDialogs(el);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].textContent).toContain('النص البديل للصورة');
  });

  it('closes the preview when Delete is opened afterwards', async () => {
    const { fixture, el } = setup([PDF_ASSET]);

    clickTile(fixture);
    expect(openDialogs(el)).toHaveLength(1);

    clickButton(fixture, 'حذف');
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogs = openDialogs(el);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].textContent).toContain('حذف هذا الملف؟');
  });
});
