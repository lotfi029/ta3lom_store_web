import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { saveFile } from '../../../core/http/save-file';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { OpsData, type ReportName } from './ops.data';

/** `YYYY-MM-DD` of a date in Asia/Riyadh (report days are Riyadh days, 11 §9.16). */
export function riyadhDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** The default range: the last 30 Riyadh days, today included. */
export function lastDays(n: number, now = new Date()): { from: string; to: string } {
  return { from: riyadhDay(new Date(now.getTime() - (n - 1) * 86_400_000)), to: riyadhDay(now) };
}

export const REPORTS: readonly ReportName[] = ['sales', 'vat', 'shipments'];

/** Reports (#117, FR-S75; r4: sales, VAT, shipments): a date range, a table, and the API's CSV (UTF-8 BOM). `staff:finance`. */
@Component({
  selector: 'ta-admin-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
  styleUrls: ['../admin-common.css'],
})
export class ReportsPage {
  private readonly data = inject(OpsData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly reports = REPORTS;
  protected readonly name = signal<ReportName>('sales');
  protected readonly from = signal(lastDays(30).from);
  protected readonly to = signal(lastDays(30).to);
  protected readonly rows = signal<Record<string, unknown>[] | null>(null);
  protected readonly cols = computed(() => Object.keys(this.rows()?.[0] ?? {}));
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-reports:التقارير`,
      description: '',
      path: '/admin/reports',
      noindex: true,
    });
  }

  protected reportLabel(n: ReportName): string {
    switch (n) {
      case 'sales':
        return $localize`:@@store.admin.report-sales:المبيعات اليومية`;
      case 'vat':
        return $localize`:@@store.admin.report-vat:ضريبة القيمة المضافة`;
      default:
        return $localize`:@@store.admin.report-shipments:الشحنات`;
    }
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected cell(v: unknown): string {
    return v === null || v === undefined ? '—' : String(v);
  }

  protected async show(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.rows.set((await this.data.report(this.name(), this.from(), this.to())).rows);
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }

  protected async csv(): Promise<void> {
    try {
      saveFile(
        await this.data.reportCsv(this.name(), this.from(), this.to()),
        `${this.name()}-${this.from()}-${this.to()}.csv`,
      );
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    }
  }
}
