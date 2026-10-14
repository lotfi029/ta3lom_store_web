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
import { environment } from '../../../environments/environment';
import type { Enrolment } from '../../core/api/api.types';
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

/** My courses (FR-S23): progress, Start/Resume through the LMS (#29, RUL-42), certificate when completed (#30). */
@Component({
  selector: 'ta-account-courses',
  imports: [RouterLink, Icon, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './courses.page.html',
})
export class CoursesPage {
  protected readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly list = computed(() => valueOf(this.data.enrolments) ?? []);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.tab-courses:دوراتي`,
      description: $localize`:@@store.account.seo-description:حسابك في متجر جمعية التعلم الإلكتروني.`,
      path: '/account/courses',
      noindex: true,
    });
    this.data.enrolments.reload();
  }

  protected title(e: Enrolment): string {
    return this.i18n.pick(e.product.titleAr, e.product.titleEn);
  }

  protected pct(e: Enrolment): number {
    return Math.min(100, Math.max(0, toInt(e.progressPct)));
  }

  /**
   * The certificate. `GET /me/enrolments/{id}/certificate` (#30) needs the bearer and only redirects to
   * `{web}/{locale}/store/certificates/{certificateNo}` (11 §5.5 as built), so the page links there directly.
   */
  protected certificateUrl(e: Enrolment): string | null {
    return e.status === 'completed' && e.certificateNo
      ? `${environment.mainSiteUrl}/${this.i18n.locale}/store/certificates/${encodeURIComponent(e.certificateNo)}`
      : null;
  }

  protected async launch(e: Enrolment): Promise<void> {
    if (this.busy()) return;
    this.busy.set(e.id);
    this.error.set(null);
    try {
      const { url } = await this.data.launch(e.id);
      if (this.browser) location.assign(url);
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(null);
    }
  }
}
