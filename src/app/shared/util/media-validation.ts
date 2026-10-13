/**
 * Mirrors ta3lom-api/src/media/media.service.ts EXACTLY — extension allow-list, SVG rejection,
 * per-kind size caps. The API is the real boundary (04-media-and-markdown.md: magic-byte
 * verification only happens server-side, a client can always be bypassed) — this exists so an
 * editor finds out immediately, before a 5 MB upload, rather than after.
 */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg'];
export const PDF_EXTENSION = 'pdf';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type FileValidationErrorCode = 'UNSUPPORTED_TYPE' | 'TOO_LARGE';

export interface FileValidationError {
  code: FileValidationErrorCode;
  messageAr: string;
  messageEn: string;
}

function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}`;
}

export function validateMediaFile(file: File): FileValidationError | null {
  const ext = extensionOf(file.name);

  // SVG used to be refused outright here, because it is an XML document a browser will execute
  // script from. It is accepted now, but ONLY because the API disarms it: media.service.ts stores
  // the output of common/media/sanitise-svg.ts rather than the uploaded bytes, and serves it
  // under a `default-src 'none'; sandbox` CSP. Nothing about that safety lives on this side — as
  // this file's header says, the client is a courtesy, never the boundary.
  const isImage = IMAGE_EXTENSIONS.includes(ext);
  const isPdf = ext === PDF_EXTENSION;
  if (!isImage && !isPdf) {
    return {
      code: 'UNSUPPORTED_TYPE',
      messageAr: `نوع الملف غير مسموح. الأنواع المسموحة: ${[...IMAGE_EXTENSIONS, PDF_EXTENSION].join(', ')}.`,
      messageEn: `File type not allowed. Allowed types: ${[...IMAGE_EXTENSIONS, PDF_EXTENSION].join(', ')}.`,
    };
  }

  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
  if (file.size > maxBytes) {
    return {
      code: 'TOO_LARGE',
      messageAr: `حجم الملف (${formatMb(file.size)} م.ب) أكبر من الحد المسموح (${formatMb(maxBytes)} م.ب).`,
      messageEn: `File size (${formatMb(file.size)} MB) exceeds the allowed limit (${formatMb(maxBytes)} MB).`,
    };
  }

  return null;
}
