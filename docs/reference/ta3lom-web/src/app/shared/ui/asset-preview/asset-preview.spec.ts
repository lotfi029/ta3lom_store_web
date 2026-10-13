import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdminAsset } from '../../../core/admin-media.data';
import { API_URL } from '../../../core/api.token';
import { AssetPreview } from './asset-preview';

const BASE: AdminAsset = {
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

const API = 'https://api.ta3lom.sa';
/** asset.url in production: PUBLIC_MEDIA_BASE (https://api.ta3lom.sa/media) + storage key. */
const MEDIA_URL = `${API}/media/2026/report.pdf`;

function setup(asset: AdminAsset | null, downloadUrl: string | null = null, fileUrl: string | null = null, apiUrl = API) {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: 'ar' }, { provide: API_URL, useValue: apiUrl }],
  });
  const fixture = TestBed.createComponent(AssetPreview);
  fixture.componentRef.setInput('asset', asset);
  fixture.componentRef.setInput('downloadUrl', downloadUrl);
  fixture.componentRef.setInput('fileUrl', fileUrl);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('AssetPreview', () => {
  it('is closed when asset is null', () => {
    const { el } = setup(null);
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBeFalsy();
  });

  it('renders a plain <img>, not an iframe, for an image asset', () => {
    const { el } = setup(BASE);
    expect(el.querySelector('.preview-image')).not.toBeNull();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('renders an iframe for a PDF asset, falling back to asset.url when no fileUrl is given', () => {
    const { el } = setup({ ...BASE, kind: 'pdf', mime: 'application/pdf', originalName: 'report.pdf', url: MEDIA_URL });
    const iframe = el.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toBe(MEDIA_URL);
  });

  /** CR-01: framing goes through core/trusted-frame-url.ts — only the API's own file endpoints. */
  it('never frames a file from a host outside the allow-list', () => {
    const { el } = setup({ ...BASE, kind: 'pdf', mime: 'application/pdf', url: 'https://cdn.example.com/report.pdf' });
    expect(el.querySelector('iframe')).toBeNull();
  });

  /**
   * The whole reason fileUrl exists: asset.url (the PUBLIC_MEDIA_BASE static mount) is served
   * `immutable` for a year, so a browser that fetched a PDF through it before the API stopped
   * sending X-Frame-Options keeps replaying that header from its own disk cache and refuses to
   * frame the file forever. Framing the API's streaming route instead uses a URL that browser has
   * never fetched, so it cannot already be poisoned — which only works if the iframe really does
   * prefer fileUrl over asset.url.
   */
  it('prefers fileUrl over asset.url as the PDF iframe src', () => {
    const { el } = setup(
      { ...BASE, kind: 'pdf', mime: 'application/pdf', originalName: 'report.pdf', url: MEDIA_URL },
      null,
      `${API}/media/asset-1/file`,
    );
    expect(el.querySelector('iframe')!.getAttribute('src')).toBe(`${API}/media/asset-1/file`);
  });

  it('never trusts a non-http(s) fileUrl as an iframe src', () => {
    const { el } = setup({ ...BASE, kind: 'pdf', mime: 'application/pdf' }, null, 'javascript:alert(1)');
    expect(el.querySelector('iframe')).toBeNull();
  });

  /**
   * Regression: fileUrl is only absolute in production. core/api.token.ts points the browser at
   * the relative `/api` in development, and the protocol guard used to parse the value bare —
   * `new URL('/api/media/…/file')` throws without a base, so the guard returned false and the
   * preview silently rendered an empty box locally, with no error anywhere. Caught by opening the
   * dialog in a browser; unit tests all passed because they used absolute URLs.
   */
  it('accepts a root-relative fileUrl, as used in development', () => {
    const { el } = setup(
      { ...BASE, kind: 'pdf', mime: 'application/pdf' },
      null,
      '/api/media/asset-1/file',
      '/api',
    );
    expect(el.querySelector('iframe')!.getAttribute('src')).toBe('/api/media/asset-1/file');
  });

  /**
   * showModal() autofocuses the first focusable descendant. A PDF <iframe> is focusable and,
   * once focused, is a cross-origin document that swallows Tab/Escape — so the close button MUST
   * precede it in DOM order, exactly like video-modal.html's close button precedes its YouTube
   * iframe. A visual (CSS-only) reposition would not fix this; only DOM order does.
   */
  it('places the close button before the iframe in DOM order (PDF)', () => {
    const { el } = setup({ ...BASE, kind: 'pdf', mime: 'application/pdf', url: MEDIA_URL });
    const focusable = Array.from(el.querySelectorAll('button, iframe'));
    const closeIndex = focusable.findIndex((n) => n.classList.contains('preview-close'));
    const iframeIndex = focusable.findIndex((n) => n.tagName === 'IFRAME');
    expect(closeIndex).toBeGreaterThanOrEqual(0);
    expect(iframeIndex).toBeGreaterThan(closeIndex);
  });

  it('never trusts a non-http(s) url as an iframe src', () => {
    // asset.url is server-composed in real life, never client input — this guards a bug, not an
    // attacker, but it must hold regardless.
    const { el } = setup({ ...BASE, kind: 'pdf', mime: 'application/pdf', url: 'javascript:alert(1)' });
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('shows a thumbnail and no file metadata for a YouTube asset', () => {
    const { el } = setup({
      ...BASE,
      kind: 'youtube',
      url: null,
      externalId: 'dQw4w9WgXcQ',
      mime: null,
      originalName: null,
      sizeBytes: null,
      width: null,
      height: null,
      uploadedBy: null,
    });

    expect(el.querySelector('iframe')).toBeNull();
    const img = el.querySelector<HTMLImageElement>('.preview-image');
    expect(img?.src).toContain('dQw4w9WgXcQ');

    const dt = Array.from(el.querySelectorAll('dt')).map((n) => n.textContent?.trim());
    expect(dt).not.toContain('اسم الملف');
    expect(dt).not.toContain('الحجم');
    expect(dt).not.toContain('الأبعاد');
  });

  it('renders filename, size and dimensions for an image, and both actions', () => {
    const { el } = setup(BASE, 'https://api.example.test/media/asset-1/file?download=1');

    expect(el.textContent).toContain('photo.jpg');
    expect(el.textContent).toContain('120.6 KB');
    expect(el.textContent).toContain('800 × 600');

    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.action-link'));
    expect(links).toHaveLength(2);
    expect(links.every((a) => a.getAttribute('rel') === 'noopener noreferrer')).toBe(true);
    expect(links.every((a) => a.getAttribute('target') === '_blank')).toBe(true);
    expect(links.find((a) => a.hasAttribute('download'))?.getAttribute('href')).toBe(
      'https://api.example.test/media/asset-1/file?download=1',
    );
  });

  it('offers no download action when the caller has no downloadUrl (still loading it)', () => {
    const { el } = setup(BASE, null);
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.action-link'));
    expect(links).toHaveLength(1);
    expect(links[0].hasAttribute('download')).toBe(false);
  });
});
