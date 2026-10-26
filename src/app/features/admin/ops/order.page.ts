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
import type { AdminOrderLine } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData, upperRef } from './ops.data';

/** What a donation line went to: a general gift to a category, or the project (+ the option label). */
export function lineTitle(
  l: AdminOrderLine,
  pick: (ar: string, en: string | null) => string,
): string {
  const title = pick(l.titleAr, l.titleEn);
  if (l.targetKind === 'category')
    return `${$localize`:@@store.cart.general-gift:تبرع عام`} — ${title}`;
  return l.optionLabelAr ? `${title} — ${l.optionLabelAr}` : title;
}

/**
 * `/admin/orders/:ref` (contract 15 §2.8): donor, lines and status of one donation order; a pending order can be
 * cancelled (`staff:orders`, confirmed first). API-1: the 409 `order.cancel_not_allowed` body's `status` extension is
 * ignored — the message comes from `code` and the page reloads the order to show its real state.
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

  protected readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly o = computed(() => valueOf(this.data.order));
  protected readonly notFound = computed(() => toProblem(this.data.order.error()).status === 404);
  protected readonly label = orderStatus;
  protected readonly int = toInt;
  protected readonly canCancel = computed(
    () => this.o()?.status === 'pending_payment' && this.auth.can('staff:orders'),
  );
  protected readonly confirmOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const ref = upperRef(this.ref());
      untracked(() => {
        this.data.orderRef.set(ref);
        this.data.order.reload();
        this.seo.set({ title: ref, description: '', path: `/admin/orders/${ref}`, noindex: true });
      });
    });
  }

  protected title(l: AdminOrderLine): string {
    return lineTitle(l, (ar, en) => this.i18n.pick(ar, en));
  }

  protected async cancel(): Promise<void> {
    const o = this.o();
    if (!o || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.data.cancelOrder(o.reference);
      this.confirmOpen.set(false);
      this.toast.show($localize`:@@store.admin.order-cancelled:أُلغي الطلب.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
      this.data.order.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
