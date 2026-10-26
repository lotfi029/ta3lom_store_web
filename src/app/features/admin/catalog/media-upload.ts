import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { MediaAsset } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { CatalogAdminData } from './catalog-admin.data';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Client checks before an upload (the API checks again): an image type and the Arabic alt text (`media.alt_required`).
 * The size limit is NOT checked here — it is the API's (413 `media.too_large` + `max` in bytes, shown in MB; a bare
 * proxy 413 gets the generic too-large text).
 */
export function uploadProblem(file: { type: string } | null, altAr: string): string | null {
  if (!file) return $localize`:@@store.admin.file-required:اختر ملفًا.`;
  if (!IMAGE_TYPES.includes(file.type))
    return $localize`:@@store.error.media-type-not-allowed:نوع الملف غير مسموح. ارفع صورة JPEG أو PNG أو WebP.`;
  if (!altAr.trim())
    return $localize`:@@store.error.media-alt-required:أضف نصًا بديلًا بالعربية للصورة.`;
  return null;
}

/** Upload an image with its alt text (Arabic required, English optional — falls back to Arabic). */
@Component({
  selector: 'ta-media-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="up" (submit)="submit($event)" novalidate>
      <div class="field">
        <label [for]="idPrefix() + '-file'" i18n="@@store.admin.upload-image"
          >صورة (JPEG أو PNG أو WebP)</label
        >
        <input
          [id]="idPrefix() + '-file'"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          (change)="onFile($event)"
        />
      </div>
      <div class="field">
        <label [for]="idPrefix() + '-alt-ar'" i18n="@@store.admin.alt-ar">النص البديل (عربي)</label>
        <input
          [id]="idPrefix() + '-alt-ar'"
          maxlength="300"
          [value]="altAr()"
          (input)="altAr.set(value($event))"
        />
      </div>
      <div class="field">
        <label [for]="idPrefix() + '-alt-en'" i18n="@@store.admin.alt-en-optional"
          >النص البديل (إنجليزي، اختياري)</label
        >
        <input
          [id]="idPrefix() + '-alt-en'"
          dir="ltr"
          maxlength="300"
          [value]="altEn()"
          (input)="altEn.set(value($event))"
        />
      </div>
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
  readonly idPrefix = input('mu');
  readonly uploaded = output<MediaAsset>();

  protected readonly file = signal<File | null>(null);
  protected readonly altAr = signal('');
  protected readonly altEn = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

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
    const problem = uploadProblem(f, this.altAr());
    if (problem || !f) {
      this.error.set(problem);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const asset = await this.data.upload(f, this.altAr(), this.altEn());
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
