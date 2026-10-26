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
import { customerStatus, orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData } from './ops.data';

/**
 * `/admin/donors/:id` (contract 15 §2.8): profile, consent, last 20 orders; block (revokes the donor's sessions) or
 * unblock with `staff:customers`, confirmed first. An anonymised donor has no personal data and cannot be blocked.
 */
@Component({
  selector: 'ta-admin-donor',
  imports: [RouterLink, Dialog, Money, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './donor.page.html',
  styleUrls: ['../admin-common.css', './order.page.css'],
})
export class DonorPage {
  readonly id = input.required<string>();

  protected readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly c = computed(() => valueOf(this.data.donor));
  protected readonly notFound = computed(() => toProblem(this.data.donor.error()).status === 404);
  protected readonly label = customerStatus;
  protected readonly orderLabel = orderStatus;
  protected readonly int = toInt;
  protected readonly canBlock = computed(() => this.auth.can('staff:customers'));
  protected readonly confirmOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.donor:المتبرع`,
      description: '',
      path: '/admin/donors',
      noindex: true,
    });
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.data.donorId.set(id);
        this.data.donor.reload();
      });
    });
  }

  protected async toggle(): Promise<void> {
    const c = this.c();
    if (!c || this.busy()) return;
    const block = c.status === 'active';
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.data.setBlocked(c.id, block);
      this.confirmOpen.set(false);
      this.toast.show(
        block
          ? $localize`:@@store.admin.donor-blocked-toast:أُوقف حساب المتبرع وأُغلقت جلساته.`
          : $localize`:@@store.admin.donor-unblocked-toast:أُعيد تفعيل حساب المتبرع.`,
        'success',
      );
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
