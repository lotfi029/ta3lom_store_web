import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  untracked,
} from '@angular/core';
import type { MediaAsset } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { CatalogAdminData } from './catalog-admin.data';
import { MediaUpload } from './media-upload';

/** Pick a cover image from the media library, or upload one with its alt text (RUL-03). */
@Component({
  selector: 'ta-media-picker',
  imports: [Dialog, MediaUpload],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-dialog [(open)]="open" labelledBy="mp-h" [lightDismiss]="false">
      <div class="dlg wide">
        <h2 id="mp-h" i18n="@@store.admin.choose-cover">اختيار صورة الغلاف</h2>
        <ul class="grid">
          @for (a of images(); track a.id) {
            <li>
              <button type="button" class="pick" (click)="choose(a)">
                <img
                  [src]="a.url"
                  [alt]="i18n.pick(a.altAr ?? '', a.altEn)"
                  loading="lazy"
                  width="160"
                  height="107"
                />
                <span class="visually-hidden" i18n="@@store.admin.choose">اختيار</span>
              </button>
            </li>
          } @empty {
            <li class="muted" i18n="@@store.admin.no-images">لا صور بعد.</li>
          }
        </ul>
        <h3 i18n="@@store.admin.upload-new">رفع صورة جديدة</h3>
        <ta-media-upload kind="image" idPrefix="mp" (uploaded)="choose($event)" />
        <div class="acts">
          <button type="button" class="btn" (click)="open.set(false)" i18n="@@store.account.cancel">
            إلغاء
          </button>
        </div>
      </div>
    </ta-dialog>
  `,
  styleUrls: ['../admin-common.css'],
  styles: `
    .wide {
      inline-size: min(760px, 92vw);
      max-block-size: 85vh;
      overflow-y: auto;
    }
    .grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .pick {
      display: block;
      inline-size: 100%;
      padding: 0;
      border: 2px solid var(--c-border);
      border-radius: 10px;
      overflow: hidden;
      background: var(--c-surface-2);
      cursor: pointer;
    }
    .pick:hover,
    .pick:focus-visible {
      border-color: var(--c-brand);
    }
    img {
      display: block;
      inline-size: 100%;
      block-size: auto;
      aspect-ratio: 3 / 2;
      object-fit: cover;
    }
    h3 {
      font-size: 1rem;
      margin: 0;
    }
  `,
})
export class MediaPicker {
  private readonly data = inject(CatalogAdminData);
  protected readonly i18n = inject(I18nService);
  readonly open = model(false);
  readonly picked = output<MediaAsset>();

  protected readonly images = computed(() =>
    (valueOf(this.data.media)?.items ?? []).filter((a) => a.kind === 'image' && a.url),
  );

  constructor() {
    effect(() => {
      if (this.open())
        untracked(() => {
          this.data.mediaKind.set('image');
          this.data.mediaPage.set(1);
        });
    });
  }

  protected choose(a: MediaAsset): void {
    this.picked.emit(a);
    this.open.set(false);
  }
}
