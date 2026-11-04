import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toProblem } from '../../../core/api/problem';
import { problemMessage } from '../../../core/api/problem-message';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { saveFile } from '../../../core/http/save-file';
import { RIYADH } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Requires } from '../ui/requires';
import { OpsData } from '../ops/ops.data';

/** The API's limit for one export (FinanceReports.MaxDays). */
export const REPORT_MAX_DAYS = 366;

/** `YYYY-MM-DD` of an instant in Riyadh. */
export function riyadhDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Inclusive day count between two `YYYY-MM-DD` dates (calendar arithmetic in UTC, no time zone involved). */
export function daySpan(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** A range the API accepts: both valid dates, from ≤ to, at most {@link REPORT_MAX_DAYS} days. */
export function validRange(from: string, to: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return false;
  const n = daySpan(from, to);
  return n >= 1 && n <= REPORT_MAX_DAYS;
}

/**
 * `/admin/reports` (R5-Payments, plan §6 F5): the donations CSV for a Riyadh date range (`staff:finance`). The file is
 * fetched with the staff bearer and saved through an object URL; mobiles are masked by the API, cells are
 * injection-safe and the file has a BOM so Excel reads the Arabic.
 */
@Component({
  selector: 'ta-admin-reports',
  imports: [Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ahead">
      <div>
        <h1 i18n="@@store.admin.nav-reports">التقارير</h1>
        <p i18n="@@store.admin.reports-lede">
          ملف التبرعات المدفوعة والمستردة لفترة بتوقيت الرياض (حتى سنة واحدة)، بأرقام جوال مخفية.
        </p>
      </div>
      <ta-requires policy="staff:finance" />
    </div>
    <form class="panel rep" (submit)="$event.preventDefault(); download()">
      <h2 i18n="@@store.admin.report-donations">تقرير التبرعات (CSV)</h2>
      <div class="row">
        <div class="field">
          <label for="rep-from" i18n="@@store.admin.report-from">من تاريخ</label>
          <input id="rep-from" type="date" dir="ltr" [value]="from()" (input)="from.set(text($event))" />
        </div>
        <div class="field">
          <label for="rep-to" i18n="@@store.admin.report-to">إلى تاريخ</label>
          <input id="rep-to" type="date" dir="ltr" [value]="to()" (input)="to.set(text($event))" />
        </div>
      </div>
      @if (!valid()) {
        <p class="err" i18n="@@store.admin.report-range-invalid">اختر فترة صحيحة لا تزيد على 366 يومًا.</p>
      }
      @if (error(); as e) {
        <p class="err" role="alert">{{ e }}</p>
      }
      <div>
        <button type="submit" class="btn primary" [disabled]="!valid() || busy() || !canFinance()" [attr.aria-busy]="busy()"
          i18n="@@store.admin.report-download">تنزيل الملف</button>
      </div>
    </form>
  `,
  styles: `
    .rep { display: grid; gap: 12px; max-inline-size: 640px; }
    .rep .row { display: flex; flex-wrap: wrap; gap: 12px; }
    .rep .field { margin: 0; flex: 1 1 200px; }
  `,
  styleUrls: ['../admin-common.css'],
})
export class ReportsPage {
  private readonly data = inject(OpsData);
  private readonly auth = inject(StaffAuth);
  private readonly seo = inject(SeoService);

  private readonly today = riyadhDate(new Date());
  protected readonly from = signal(`${this.today.slice(0, 8)}01`);
  protected readonly to = signal(this.today);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly valid = computed(() => validRange(this.from(), this.to()));
  protected readonly canFinance = computed(() => this.auth.can('staff:finance'));

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-reports:التقارير`,
      description: '',
      path: '/admin/reports',
      noindex: true,
    });
  }

  protected text(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected async download(): Promise<void> {
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { blob, fileName } = await this.data.donationsCsv(this.from(), this.to());
      saveFile(blob, fileName);
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
