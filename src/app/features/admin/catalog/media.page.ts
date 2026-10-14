import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { MediaAsset } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { Requires } from '../ui/requires';
import { CatalogAdminData, MEDIA_PAGE_SIZE } from './catalog-admin.data';
import { MediaUpload } from './media-upload';

/** Media library (#75–#77, RUL-03): images (public, alt text required in both languages) and PDFs. */
@Component({
  selector: 'ta-admin-media',
  imports: [ResourceState, Requires, MediaUpload],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media.page.html',
  styleUrls: ['../admin-common.css', './media.page.css'],
})
export class MediaPage {
  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly page = computed(() => valueOf(this.data.media));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / MEDIA_PAGE_SIZE)),
  );
  protected readonly editing = signal<string | null>(null);
  protected readonly alt = signal({ ar: '', en: '' });
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-media:الوسائط`,
      description: '',
      path: '/admin/media',
      noindex: true,
    });
    this.data.media.reload();
  }

  protected setKind(e: Event): void {
    this.data.mediaKind.set((e.target as HTMLSelectElement).value as '' | 'image' | 'pdf');
    this.data.mediaPage.set(1);
  }

  protected go(page: number): void {
    this.data.mediaPage.set(Math.min(this.pages(), Math.max(1, page)));
  }

  protected size(a: MediaAsset): string {
    const kb = toInt(a.sizeBytes) / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  }

  protected edit(a: MediaAsset): void {
    this.alt.set({ ar: a.altAr ?? '', en: a.altEn ?? '' });
    this.error.set(null);
    this.editing.set(a.id);
  }

  protected setAlt(lang: 'ar' | 'en', e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.alt.update((x) => ({ ...x, [lang]: v }));
  }

  protected async saveAlt(a: MediaAsset, e: Event): Promise<void> {
    e.preventDefault();
    const { ar, en } = this.alt();
    if (!ar.trim() || !en.trim()) {
      this.error.set(
        $localize`:@@store.admin.alt-required:النص البديل بالعربية والإنجليزية مطلوب للصور.`,
      );
      return;
    }
    try {
      await this.data.saveAlt(a.id, { altAr: ar.trim(), altEn: en.trim() });
      this.editing.set(null);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    }
  }

  protected uploaded(): void {
    this.toast.show($localize`:@@store.admin.uploaded:رُفع الملف.`, 'success');
  }
}
