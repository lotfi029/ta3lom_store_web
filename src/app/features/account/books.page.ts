import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BookDownload, BookShipment } from '../../core/api/api.types';
import { toInt } from '../../core/api/api.types';
import { problemMessage } from '../../core/api/problem-message';
import { toProblem } from '../../core/api/problem';
import { valueOf } from '../../core/http/resource-value';
import { I18nService } from '../../core/i18n/i18n';
import { SeoService } from '../../core/seo/seo.service';
import { Icon } from '../../shared/ui/icon/icon';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { AccountData } from './account.data';
import { shipmentStatus } from './labels';

/**
 * My books (FR-S24): digital downloads with the remaining count (RUL-41) and print shipments with tracking (RUL-40).
 * A download asks for a signed 10-minute link (#32) and the browser navigates to it (#46), so the PDF streams as a file.
 */
@Component({
  selector: 'ta-account-books',
  imports: [RouterLink, Icon, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './books.page.html',
})
export class BooksPage {
  protected readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly books = computed(() => valueOf(this.data.books));
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly status = shipmentStatus;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.tab-books:كتبي`,
      description: $localize`:@@store.account.seo-description:حسابك في متجر جمعية التعلم الإلكتروني.`,
      path: '/account/books',
      noindex: true,
    });
    this.data.books.reload();
  }

  protected title(x: { titleAr: string; titleEn: string | null }): string {
    return this.i18n.pick(x.titleAr, x.titleEn);
  }

  protected remaining(d: BookDownload): number {
    return Math.max(0, toInt(d.maxDownloads) - toInt(d.downloadCount));
  }

  protected qty(n: number | string): number {
    return toInt(n, 1);
  }

  protected date(s: BookShipment): string | null {
    const at = s.deliveredAt ?? s.shippedAt;
    return at ? this.i18n.formatDate(at) : null;
  }

  protected async download(d: BookDownload): Promise<void> {
    if (this.busy()) return;
    this.busy.set(d.grantId);
    this.error.set(null);
    try {
      const link = await this.data.downloadLink(d.grantId);
      if (this.browser) location.assign(link.url);
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(null);
    }
  }
}
