import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, validateMediaFile } from './media-validation';

function fakeFile(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe('validateMediaFile', () => {
  it('accepts a jpg within the image size cap', () => {
    expect(validateMediaFile(fakeFile('photo.jpg', 1024))).toBeNull();
  });

  it.each(['jpg', 'jpeg', 'png', 'webp', 'avif'])('accepts .%s images', (ext) => {
    expect(validateMediaFile(fakeFile(`photo.${ext}`, 1024))).toBeNull();
  });

  it('accepts a pdf within the pdf size cap', () => {
    expect(validateMediaFile(fakeFile('report.pdf', 1024))).toBeNull();
  });

  /** SVG was refused outright until the API gained a sanitiser for it — it is accepted here
   *  now, and the safety lives server-side (media.service.ts stores the sanitised bytes and
   *  serves them sandboxed). This test guards the CLIENT contract only. */
  it('accepts .svg as an image', () => {
    expect(validateMediaFile(fakeFile('logo.svg', 100))).toBeNull();
  });

  it('holds .svg to the image size cap, not the larger pdf one', () => {
    expect(validateMediaFile(fakeFile('huge.svg', MAX_IMAGE_BYTES + 1))?.code).toBe('TOO_LARGE');
  });

  it('rejects an unsupported extension', () => {
    const error = validateMediaFile(fakeFile('video.mp4', 100));
    expect(error?.code).toBe('UNSUPPORTED_TYPE');
  });

  it('rejects an image over the 5 MB cap', () => {
    const error = validateMediaFile(fakeFile('huge.png', MAX_IMAGE_BYTES + 1));
    expect(error?.code).toBe('TOO_LARGE');
  });

  it('accepts an image at exactly the 5 MB cap', () => {
    expect(validateMediaFile(fakeFile('exact.png', MAX_IMAGE_BYTES))).toBeNull();
  });

  it('rejects a PDF over the 10 MB cap', () => {
    const error = validateMediaFile(fakeFile('huge.pdf', MAX_PDF_BYTES + 1));
    expect(error?.code).toBe('TOO_LARGE');
  });

  it('allows a PDF up to 10 MB even though that is larger than the image cap', () => {
    expect(validateMediaFile(fakeFile('big-report.pdf', MAX_IMAGE_BYTES + 1))).toBeNull();
  });

  it('is case-insensitive on the extension', () => {
    expect(validateMediaFile(fakeFile('PHOTO.JPG', 1024))).toBeNull();
    expect(validateMediaFile(fakeFile('LOGO.SVG', 100))).toBeNull();
  });
});
