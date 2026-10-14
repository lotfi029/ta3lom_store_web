import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { MediaAsset } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { CatalogAdminData } from './catalog-admin.data';

export type UploadKind = 'image' | 'pdf' | 'book_file';

const ACCEPT: Record<UploadKind, string> = {
  image: 'image/jpeg,image/png,image/webp',
  pdf: 'application/pdf',
  book_file: 'application/pdf',
};
const MAX_BYTES: Record<UploadKind, number> = {
  image: 10 * 1024 * 1024,
  pdf: 200 * 1024 * 1024,
  book_file: 200 * 1024 * 1024,
};

/** Client checks before upload (the API checks again): MIME per kind, size limits, alt text for images (RUL-03). */
export function uploadProblem(
  kind: UploadKind,
  file: { type: string; size: number } | null,
  altAr: string,
  altEn: string,
): string | null {
  if (!file) return $localize`:@@store.admin.file-required:اختر ملفًا.`;
  if (!ACCEPT[kind].split(',').includes(file.type))
    return $localize`:@@store.error.media-type-not-allowed:نوع الملف غير مسموح.`;
  if (file.size > MAX_BYTES[kind])
    return $localize`:@@store.error.media-too-large:حجم الملف أكبر من المسموح.`;
  if (kind === 'image' && (!altAr.trim() || !altEn.trim()))
    return $localize`:@@store.admin.alt-required:النص البديل بالعربية والإنجليزية مطلوب للصور.`;
  return null;
}

/** Upload a media asset (#75): file, then alt text in both languages for images (mandatory, RUL-03). */
@Component({
  selector: 'ta-media-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="up" (submit)="submit($event)" novalidate>
      <div class="field">
        <label [for]="idPrefix() + '-file'">
          @switch (kind()) {
            @case ('image') {
              <span i18n="@@store.admin.upload-image"
                >صورة (JPG أو PNG أو WebP، حتى 10 ميغابايت)</span
              >
            }
            @default {
              <span i18n="@@store.admin.upload-pdf">ملف PDF (حتى 200 ميغابايت)</span>
            }
          }
        </label>
        <input
          [id]="idPrefix() + '-file'"
          type="file"
          [attr.accept]="accept()"
          (change)="onFile($event)"
        />
      </div>
      @if (kind() === 'image') {
        <div class="field">
          <label [for]="idPrefix() + '-alt-ar'" i18n="@@store.admin.alt-ar"
            >النص البديل (عربي)</label
          >
          <input
            [id]="idPrefix() + '-alt-ar'"
            [value]="altAr()"
            (input)="altAr.set(value($event))"
          />
        </div>
        <div class="field">
          <label [for]="idPrefix() + '-alt-en'" i18n="@@store.admin.alt-en"
            >النص البديل (إنجليزي)</label
          >
          <input
            [id]="idPrefix() + '-alt-en'"
            dir="ltr"
            [value]="altEn()"
            (input)="altEn.set(value($event))"
          />
        </div>
      }
      @if (error(); as e) {
        <p class="err" role="alert">{{ e }}</p>
      }
      <div>
        <button
          type="submit"
          class="btn primary"
          [disabled]="busy()"
          [attr.aria-busy]="busy()"
          i18n="@@store.admin.upload"
        >
          رفع
        </button>
      </div>
    </form>
  `,
  styleUrls: ['../admin-common.css'],
  styles: `
    .up {
      display: grid;
      gap: 12px;
    }
    .field {
      margin: 0;
    }
  `,
})
export class MediaUpload {
  private readonly data = inject(CatalogAdminData);
  readonly kind = input<UploadKind>('image');
  readonly idPrefix = input('mu');
  readonly uploaded = output<MediaAsset>();

  protected readonly file = signal<File | null>(null);
  protected readonly altAr = signal('');
  protected readonly altEn = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected accept(): string {
    return ACCEPT[this.kind()];
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected onFile(e: Event): void {
    this.file.set((e.target as HTMLInputElement).files?.[0] ?? null);
    this.error.set(null);
  }

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    const f = this.file();
    const problem = uploadProblem(this.kind(), f, this.altAr(), this.altEn());
    if (problem || !f) {
      this.error.set(problem);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const asset = await this.data.upload(f, this.kind(), this.altAr(), this.altEn());
      this.altAr.set('');
      this.altEn.set('');
      this.uploaded.emit(asset);
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
