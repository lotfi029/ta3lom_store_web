import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Shipment } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { saveFile } from '../../../core/http/save-file';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { shipmentStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData, PAGE_SIZE } from './ops.data';

export const SHIPMENT_TABS = ['preparing', 'shipped', 'delivered', 'returned'] as const;
type Action = { kind: 'ship' | 'deliver' | 'return'; s: Shipment } | null;

/**
 * Shipments queue (#95–#99, FR-S42, RUL-40): by status; packing slip PDF; ship (carrier + tracking, SMS to the customer),
 * deliver (date), return (note, restock). Actions need `staff:fulfilment`.
 */
@Component({
  selector: 'ta-admin-shipments',
  imports: [RouterLink, Dialog, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipments.page.html',
  styleUrls: ['../admin-common.css', './shipments.page.css'],
})
export class ShipmentsPage {
  protected readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly tabs = SHIPMENT_TABS;
  protected readonly label = shipmentStatus;
  protected readonly canAct = computed(() => this.auth.can('staff:fulfilment'));
  protected readonly page = computed(() => valueOf(this.data.shipments));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PAGE_SIZE)),
  );

  protected readonly action = signal<Action>(null);
  protected readonly open = signal(false);
  protected readonly carrier = signal('SMSA');
  protected readonly tracking = signal('');
  protected readonly deliveredOn = signal('');
  protected readonly note = signal('');
  protected readonly restock = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-shipments:الشحنات`,
      description: '',
      path: '/admin/shipments',
      noindex: true,
    });
    this.data.shipments.reload();
  }

  protected tab(s: string): void {
    this.data.shipmentStatus.set(s);
    this.data.shipmentPage.set(1);
  }

  protected go(page: number): void {
    this.data.shipmentPage.set(Math.min(this.pages(), Math.max(1, page)));
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected qty(n: number | string): number {
    return toInt(n, 1);
  }

  protected ask(kind: 'ship' | 'deliver' | 'return', s: Shipment): void {
    this.action.set({ kind, s });
    this.tracking.set('');
    this.deliveredOn.set('');
    this.note.set('');
    this.restock.set(true);
    this.error.set(null);
    this.open.set(true);
  }

  protected async slip(s: Shipment): Promise<void> {
    try {
      saveFile(await this.data.packingSlip(s.id), `packing-slip-${s.orderRef}.pdf`);
    } catch (err) {
      this.toast.show(problemMessage(toProblem(err)), 'error');
    }
  }

  protected async run(e: Event): Promise<void> {
    e.preventDefault();
    const a = this.action();
    if (!a || this.busy()) return;
    if (a.kind === 'ship' && (!this.carrier().trim() || !this.tracking().trim())) {
      this.error.set($localize`:@@store.admin.tracking-required:أدخل شركة الشحن ورقم التتبّع.`);
      return;
    }
    if (a.kind === 'return' && !this.note().trim()) {
      this.error.set($localize`:@@store.admin.reason-required:اذكر السبب.`);
      return;
    }
    this.busy.set(true);
    try {
      if (a.kind === 'ship')
        await this.data.ship(a.s.id, this.carrier().trim(), this.tracking().trim());
      else if (a.kind === 'deliver') await this.data.deliver(a.s.id, this.deliveredOn() || null);
      else await this.data.returnShipment(a.s.id, this.note().trim(), this.restock());
      this.open.set(false);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
