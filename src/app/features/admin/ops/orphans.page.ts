import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { OrphanPayment } from '../../../core/api/api.types';
import { toProblem } from '../../../core/api/problem';
import { problemMessage } from '../../../core/api/problem-message';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { Requires } from '../ui/requires';
import { OpsData } from './ops.data';

/** A resolution note the API accepts: 1–500 characters after trimming. */
export const validNote = (note: string): boolean => note.trim().length > 0 && note.trim().length <= 500;

/**
 * `/admin/payments/orphans` (review 04 A-3, W-3; `staff:finance`): payments the gateway captured for which the store has
 * no order — the gateway's ids, the amount and currency as it reported them. Finance settles each one outside the
 * store (refund on the dashboard, match it to a donor…) and records what it did here, once.
 */
@Component({
  selector: 'ta-admin-orphans',
  imports: [Dialog, Money, ResourceState, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ahead">
      <div>
        <h1 i18n="@@store.admin.nav-orphans">دفعات بلا طلب</h1>
        <p i18n="@@store.admin.orphans-lede">
          دفعات حصّلتها بوابة الدفع ولا يقابلها طلب في المتجر. عالجها من لوحة البوابة ثم سجّل ما فعلته.
        </p>
      </div>
      <ta-requires policy="staff:finance" />
    </div>
    <div class="panel">
      <div class="tabs" role="group" i18n-aria-label="@@store.admin.orphans-filter" aria-label="عرض">
        <button type="button" class="btn" [attr.aria-pressed]="!data.orphansResolved()" (click)="data.orphansResolved.set(false)"
          i18n="@@store.admin.orphans-open">بانتظار المعالجة</button>
        <button type="button" class="btn" [attr.aria-pressed]="data.orphansResolved()" (click)="data.orphansResolved.set(true)"
          i18n="@@store.admin.orphans-resolved">تمت معالجتها</button>
      </div>
      <ta-resource-state
        [loading]="data.orphans.isLoading() && !rows()"
        [error]="!!data.orphans.error() && !rows()"
        (retry)="data.orphans.reload()"
      >
      @if (rows(); as list) {
        @if (list.length === 0) {
          <p class="muted" i18n="@@store.admin.orphans-none">لا توجد دفعات هنا.</p>
        } @else {
          <div class="tbl-wrap">
            <table class="atbl">
              <caption class="visually-hidden" i18n="@@store.admin.nav-orphans">دفعات بلا طلب</caption>
              <thead>
                <tr>
                  <th scope="col" i18n="@@store.admin.orphans-received">وصلت</th>
                  <th scope="col" i18n="@@store.admin.orphans-payment">رقم الدفعة في البوابة</th>
                  <th scope="col" i18n="@@store.admin.amount">المبلغ</th>
                  @if (data.orphansResolved()) {
                    <th scope="col" i18n="@@store.admin.orphans-note">المعالجة</th>
                  } @else {
                    <th scope="col"><span class="visually-hidden" i18n="@@store.admin.actions">إجراءات</span></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (o of list; track o.id) {
                  <tr>
                    <td>{{ i18n.formatDateTime(o.receivedAt) }}</td>
                    <td>
                      <bdi dir="ltr" class="mono">{{ o.providerPaymentId ?? '—' }}</bdi>
                      @if (o.providerInvoiceId) {
                        <br /><small class="muted"><bdi dir="ltr" class="mono">{{ o.providerInvoiceId }}</bdi></small>
                      }
                    </td>
                    <td>
                      @if (o.currency === 'SAR') {
                        <ta-money [value]="o.amount" />
                      } @else {
                        <bdi dir="ltr">{{ o.amount }} {{ o.currency ?? '?' }}</bdi>
                      }
                    </td>
                    @if (data.orphansResolved()) {
                      <td>
                        {{ o.resolutionNote }}<br />
                        <small class="muted"><bdi dir="ltr">{{ o.resolvedBy }}</bdi> ·
                          {{ o.resolvedAt ? i18n.formatDateTime(o.resolvedAt) : '' }}</small>
                      </td>
                    } @else {
                      <td>
                        <button type="button" class="btn" [disabled]="!canFinance()" (click)="open(o)"
                          i18n="@@store.admin.orphans-resolve">تسجيل المعالجة</button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      </ta-resource-state>
    </div>

    <ta-dialog [open]="!!selected()" (openChange)="$event || close()" labelledBy="orph-h" [lightDismiss]="false">
      <form class="dlg" (submit)="$event.preventDefault(); resolve()">
        <h2 id="orph-h" i18n="@@store.admin.orphans-resolve-q">ماذا فعلت بهذه الدفعة؟</h2>
        <p>
          <bdi dir="ltr" class="mono">{{ selected()?.providerPaymentId }}</bdi>
        </p>
        <div class="field">
          <label for="orph-note" i18n="@@store.admin.orphans-note-label">الملاحظة (مثلًا: استُردت من لوحة البوابة)</label>
          <textarea id="orph-note" rows="3" maxlength="500" [value]="note()" (input)="note.set(text($event))"></textarea>
        </div>
        @if (error(); as e) {
          <p class="err" role="alert">{{ e }}</p>
        }
        <div class="acts">
          <button type="submit" class="btn primary" [disabled]="busy() || !noteOk()" [attr.aria-busy]="busy()"
            i18n="@@store.admin.confirm">تأكيد</button>
          <button type="button" class="btn" (click)="close()" i18n="@@store.admin.keep">رجوع</button>
        </div>
      </form>
    </ta-dialog>
  `,
  styles: `
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-block-end: 12px; }
    .tabs .btn[aria-pressed='true'] { border-color: var(--c-accent-strong); color: var(--c-accent-strong); }
    textarea { inline-size: 100%; font: inherit; }
  `,
  styleUrls: ['../admin-common.css'],
})
export class OrphansPage {
  protected readonly data = inject(OpsData);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(StaffAuth);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly rows = computed(() => valueOf(this.data.orphans));
  protected readonly canFinance = computed(() => this.auth.can('staff:finance'));
  protected readonly selected = signal<OrphanPayment | null>(null);
  protected readonly note = signal('');
  protected readonly noteOk = computed(() => validNote(this.note()));
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-orphans:دفعات بلا طلب`,
      description: '',
      path: '/admin/payments/orphans',
      noindex: true,
    });
    this.data.orphans.reload();
  }

  protected text(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
  }

  protected open(o: OrphanPayment): void {
    this.note.set('');
    this.error.set(null);
    this.selected.set(o);
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected async resolve(): Promise<void> {
    const o = this.selected();
    if (!o || !this.noteOk() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.data.resolveOrphan(o.id, this.note().trim());
      this.toast.show($localize`:@@store.admin.orphans-resolved-toast:سُجّلت المعالجة.`, 'success');
      this.close();
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
      this.data.orphans.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
