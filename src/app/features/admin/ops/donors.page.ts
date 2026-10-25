import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type CustomerStatus, toInt } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { customerStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { type DonorFilter, OpsData, PAGE_SIZE } from './ops.data';

export const DONOR_STATUSES: readonly CustomerStatus[] = ['active', 'blocked', 'anonymised'];

/**
 * Donors (contract 15 §2.8): a Saudi mobile in any accepted form matches exactly; other text matches part of the name
 * or e-mail. Anonymised (deleted) donors are listed without personal data.
 */
@Component({
  selector: 'ta-admin-donors',
  imports: [RouterLink, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './donors.page.html',
  styleUrls: ['../admin-common.css'],
})
export class DonorsPage {
  protected readonly data = inject(OpsData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.donors));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PAGE_SIZE)),
  );
  protected readonly draft = signal<Omit<DonorFilter, 'page'>>({ ...this.data.donorFilter() });
  protected readonly statuses = DONOR_STATUSES;
  protected readonly label = customerStatus;
  protected readonly int = toInt;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-donors:المتبرعون`,
      description: '',
      path: '/admin/donors',
      noindex: true,
    });
    this.data.donors.reload();
  }

  protected set(field: keyof Omit<DonorFilter, 'page'>, e: Event): void {
    const v = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.update((d) => ({ ...d, [field]: v }));
  }

  protected apply(e: Event): void {
    e.preventDefault();
    this.data.donorFilter.set({ ...this.draft(), page: 1 });
  }

  protected go(page: number): void {
    this.data.donorFilter.update((f) => ({
      ...f,
      page: Math.min(this.pages(), Math.max(1, page)),
    }));
  }
}
