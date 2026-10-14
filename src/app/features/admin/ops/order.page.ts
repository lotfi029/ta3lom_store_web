import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AdminOrderDetail, OrderLine } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { type StoreProblem, toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { I18nService } from '../../../core/i18n/i18n';
import { isZero } from '../../../core/money/money';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import {
  documentKind,
  orderStatus,
  shipmentStatus,
} from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData } from './ops.data';

/** Orders staff may cancel (RUL-29): not yet paid. */
export const CANCELLABLE = ['pending_payment', 'payment_failed'];

/**
 * One order (#86–#88, #94; FR-S73): purchase lines, totals, contact and address, payments and gateway events,
 * notifications, documents and shipment, and a timeline from the order's own dates. Cancel (staff:finance, unpaid orders
 * only, with a reason), resend documents and reset a download grant (staff:resend) — each confirmed in words.
 */
@Component({
  selector: 'ta-admin-order',
  imports: [RouterLink, Dialog, Money, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order.page.html',
  styleUrls: ['../admin-common.css', './order.page.css'],
})
export class AdminOrderPage {
  readonly ref = input.required<string>();

  private readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly order = signal<AdminOrderDetail | null>(null);
  protected readonly problem = signal<StoreProblem | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  protected readonly lines = computed(() =>
    (this.order()?.lines ?? []).filter((l) => l.kind === 'buy'),
  );
  protected readonly canCancel = computed(() => this.auth.can('staff:finance'));
  protected readonly canResend = computed(() => this.auth.can('staff:resend'));
  protected readonly cancellable = computed(() => CANCELLABLE.includes(this.order()?.status ?? ''));
  protected readonly timeline = computed(() => {
    const o = this.order();
    if (!o) return [];
    const t: { at: string; label: string }[] = [
      { at: o.placedAt, label: $localize`:@@store.admin.tl-placed:أُنشئ الطلب` },
    ];
    if (o.paidAt) t.push({ at: o.paidAt, label: $localize`:@@store.admin.tl-paid:تأكّد الدفع` });
    if (o.cancelledAt)
      t.push({ at: o.cancelledAt, label: $localize`:@@store.admin.tl-cancelled:أُلغي الطلب` });
    for (const e of o.events)
      t.push({ at: e.receivedAt, label: `${e.eventType}${e.signatureValid ? '' : ' ⚠'}` });
    for (const n of o.notifications)
      if (n.sentAt)
        t.push({ at: n.sentAt, label: `${n.channel} · ${n.templateKey} · ${n.status}` });
    return t.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  });

  protected readonly status = orderStatus;
  protected readonly shipStatus = shipmentStatus;
  protected readonly docKind = documentKind;
  protected readonly isZero = isZero;

  // cancel
  protected readonly cancelOpen = signal(false);
  protected readonly reason = signal('');
  protected readonly cancelError = signal<string | null>(null);
  // resend
  protected readonly resendOpen = signal(false);
  protected readonly channels = signal<string[]>(['sms', 'email']);
  // grant reset
  protected readonly grantId = signal('');
  protected readonly grantReason = signal('');
  protected readonly grantError = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.order-title:تفاصيل الطلب`,
      description: '',
      path: '/admin/orders',
      noindex: true,
    });
    effect(() => {
      const ref = this.ref();
      untracked(() => void this.load(ref));
    });
  }

  protected async load(ref: string): Promise<void> {
    this.loading.set(true);
    this.problem.set(null);
    try {
      this.order.set(await this.data.order(ref));
    } catch (e) {
      this.problem.set(toProblem(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected title(l: OrderLine): string {
    return this.i18n.pick(l.titleAr, l.titleEn);
  }

  protected int(v: number | string): number {
    return toInt(v);
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected openCancel(): void {
    this.reason.set('');
    this.cancelError.set(null);
    this.cancelOpen.set(true);
  }

  protected async confirmCancel(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (!this.reason().trim()) {
      this.cancelError.set($localize`:@@store.admin.reason-required:اذكر السبب.`);
      return;
    }
    this.busy.set(true);
    try {
      this.order.set(await this.data.cancel(this.ref(), this.reason().trim()));
      this.cancelOpen.set(false);
      this.toast.show(
        $localize`:@@store.admin.order-cancelled:أُلغي الطلب وأُعيد المخزون.`,
        'success',
      );
    } catch (err) {
      this.cancelError.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }

  protected toggleChannel(ch: string, e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.channels.update((c) => (on ? [...new Set([...c, ch])] : c.filter((x) => x !== ch)));
  }

  protected async confirmResend(): Promise<void> {
    if (this.busy() || this.channels().length === 0) return;
    this.busy.set(true);
    try {
      await this.data.resend(this.ref(), this.channels());
      this.resendOpen.set(false);
      this.toast.show($localize`:@@store.admin.resent:أُعيد إرسال المستندات.`, 'success');
    } catch (err) {
      this.resendOpen.set(false);
      this.toast.show(problemMessage(toProblem(err)), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async resetGrant(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (!/^[0-9a-f-]{36}$/i.test(this.grantId().trim()) || !this.grantReason().trim()) {
      this.grantError.set($localize`:@@store.admin.grant-invalid:أدخل معرّف التنزيل والسبب.`);
      return;
    }
    this.busy.set(true);
    this.grantError.set(null);
    try {
      const g = await this.data.resetGrant(this.grantId().trim(), this.grantReason().trim());
      this.grantId.set('');
      this.grantReason.set('');
      this.toast.show(
        $localize`:@@store.admin.grant-reset:أُعيد عدّاد التنزيل (${toInt(g.maxDownloads)}:max: متاحة).`,
        'success',
      );
    } catch (err) {
      this.grantError.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
