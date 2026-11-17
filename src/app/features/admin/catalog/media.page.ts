import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { MediaAsset } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { type ViewTab, ViewTabs } from '../ui/index-page/view-tabs';
import { Requires } from '../ui/requires';
import { CatalogAdminData, MEDIA_PAGE_SIZE } from './catalog-admin.data';
import { MediaUpload } from './media-upload';

/** A file size for people: KB below 1 MB, else MB with one decimal. */
export function fileSize(bytes: number | string): string {
  const kb = toInt(bytes) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
}

/** The file name at the end of a media URL (for the tile caption); the id when there is no URL. */
export function fileName(a: Pick<MediaAsset, 'id' | 'url'>): string {
  const last = (a.url ?? '').split('?')[0]!.split('/').pop();
  return last ? decodeURIComponent(last) : a.id.slice(0, 8);
}

/**
 * Media library (contract 15 §2.7; docs/admin-redesign mockup D-Media): public images for covers and categories, a grid
 * with a detail panel (a dialog ≤ 1100px) for the alt texts (Arabic required), size, date and the copy-URL action.
 * «بلا نص بديل إنجليزي» filters the loaded page only — the API has no such filter (03 §13.12).
 */
@Component({
  selector: 'ta-admin-media',
  imports: [NgTemplateOutlet, ResourceState, Requires, MediaUpload, ViewTabs, Dialog, Icon],
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
  protected readonly size = fileSize;
  protected readonly editing = signal<string | null>(null);
  protected readonly alt = signal({ ar: '', en: '' });
  protected readonly error = signal<string | null>(null);
  protected readonly name = fileName;
  protected readonly view = signal<'all' | 'no-en'>('all');
  protected readonly uploadOpen = signal(false);
  protected readonly shown = computed(() =>
    this.view() === 'no-en' ? this.items().filter((a) => !a.altEn?.trim()) : this.items(),
  );
  protected readonly tabs = computed<ViewTab[]>(() => [
    { key: 'all', label: $localize`:@@store.admin.media-all:كل الصور` },
    {
      key: 'no-en',
      label: $localize`:@@store.admin.media-no-en:بلا نص بديل إنجليزي (هذه الصفحة)`,
      count: this.items().filter((a) => !a.altEn?.trim()).length,
    },
  ]);
  protected readonly selected = computed(
    () => this.items().find((a) => a.id === this.editing()) ?? null,
  );
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly wide = signal(this.browser && window.matchMedia('(width > 1100px)').matches);
  protected readonly dialogOpen = signal(false);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-media:الوسائط`,
      description: '',
      path: '/admin/media',
      noindex: true,
    });
    this.data.media.reload();
    if (this.browser) {
      const mq = window.matchMedia('(width > 1100px)');
      const on = (e: MediaQueryListEvent) => this.wide.set(e.matches);
      mq.addEventListener('change', on);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', on));
    }
  }

  protected go(page: number): void {
    this.editing.set(null);
    this.data.mediaPage.set(Math.min(this.pages(), Math.max(1, page)));
  }

  protected edit(a: MediaAsset): void {
    this.alt.set({ ar: a.altAr ?? '', en: a.altEn ?? '' });
    this.error.set(null);
    this.editing.set(a.id);
    if (!this.wide()) this.dialogOpen.set(true);
  }

  protected close(): void {
    this.editing.set(null);
    this.dialogOpen.set(false);
  }

  protected async copy(a: MediaAsset): Promise<void> {
    if (!a.url) return;
    try {
      await navigator.clipboard.writeText(a.url);
      this.toast.show($localize`:@@store.admin.url-copied:نُسخ الرابط.`, 'success');
    } catch {
      this.toast.show($localize`:@@store.admin.url-copy-failed:تعذّر نسخ الرابط.`, 'error');
    }
  }

  protected setAlt(lang: 'ar' | 'en', e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.alt.update((x) => ({ ...x, [lang]: v }));
  }

  protected async saveAlt(a: MediaAsset, e: Event): Promise<void> {
    e.preventDefault();
    const { ar, en } = this.alt();
    if (!ar.trim()) {
      this.error.set($localize`:@@store.error.media-alt-required:أضف نصًا بديلًا بالعربية للصورة.`);
      return;
    }
    try {
      // PATCH replaces both texts: a blank English clears it (the page then falls back to Arabic).
      await this.data.saveAlt(a.id, { altAr: ar.trim(), altEn: en.trim() || null });
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    }
  }

  protected uploaded(): void {
    this.toast.show($localize`:@@store.admin.uploaded:رُفع الملف.`, 'success');
  }
}
