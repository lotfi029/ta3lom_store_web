import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Customer360, CustomerRow } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { EMAIL } from '../../../core/forms/patterns';
import { I18nService } from '../../../core/i18n/i18n';
import { normalizeSaudiMobile } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Money } from '../../../shared/ui/money/money';
import { orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData } from './ops.data';

/** The lookup as typed → the API query: an exact Saudi mobile or an email; no browsing (11 §9.20). */
export function lookupQuery(raw: string): { mobile: string } | { email: string } | null {
  const v = raw.trim();
  const mobile = normalizeSaudiMobile(v);
  if (mobile) return { mobile };
  return EMAIL.test(v) ? { email: v } : null;
}

/** Customers (#129–#132, FR-S79): exact lookup by mobile or email, the customer's orders and courses, block / unblock (RUL-61). */
@Component({
  selector: 'ta-admin-customers',
  imports: [RouterLink, Dialog, Money, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers.page.html',
  styleUrls: ['../admin-common.css', './customers.page.css'],
})
export class CustomersPage {
  private readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly q = signal('');
  protected readonly rows = signal<CustomerRow[] | null>(null);
  protected readonly selected = signal<Customer360 | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly canBlock = computed(() => this.auth.can('staff:finance'));
  protected readonly blockOpen = signal(false);
  protected readonly reason = signal('');
  protected readonly blockError = signal<string | null>(null);
  protected readonly status = orderStatus;
  protected readonly int = toInt;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-customers:العملاء`,
      description: '',
      path: '/admin/customers',
      noindex: true,
    });
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected async search(e: Event): Promise<void> {
    e.preventDefault();
    const query = lookupQuery(this.q());
    if (!query) {
      this.error.set(
        $localize`:@@store.admin.lookup-invalid:أدخل جوالًا سعوديًا كاملًا أو بريدًا إلكترونيًا.`,
      );
      return;
    }
    this.error.set(null);
    this.selected.set(null);
    try {
      this.rows.set(await this.data.findCustomers(query));
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    }
  }

  protected async open(c: CustomerRow): Promise<void> {
    try {
      this.selected.set(await this.data.customer(c.id));
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    }
  }

  protected title(x: { titleAr: string; titleEn: string | null }): string {
    return this.i18n.pick(x.titleAr, x.titleEn);
  }

  protected askBlock(): void {
    this.reason.set('');
    this.blockError.set(null);
    this.blockOpen.set(true);
  }

  private replace(row: CustomerRow): void {
    this.selected.update((s) => (s ? { ...s, customer: row } : s));
    this.rows.update((r) => r?.map((x) => (x.id === row.id ? row : x)) ?? r);
  }

  protected async block(e: Event): Promise<void> {
    e.preventDefault();
    const c = this.selected()?.customer;
    if (!c || this.busy()) return;
    if (!this.reason().trim()) {
      this.blockError.set($localize`:@@store.admin.reason-required:اذكر السبب.`);
      return;
    }
    this.busy.set(true);
    try {
      this.replace(await this.data.block(c.id, this.reason().trim()));
      this.blockOpen.set(false);
      this.toast.show($localize`:@@store.admin.blocked:أُوقف الحساب وأُنهيت جلساته.`, 'success');
    } catch (err) {
      this.blockError.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }

  protected async unblock(): Promise<void> {
    const c = this.selected()?.customer;
    if (!c || this.busy()) return;
    this.busy.set(true);
    try {
      this.replace(await this.data.unblock(c.id));
      this.toast.show($localize`:@@store.admin.unblocked:أُعيد تفعيل الحساب.`, 'success');
    } catch (err) {
      this.toast.show(problemMessage(toProblem(err)), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
