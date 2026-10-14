import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { StockMovement, StockRow } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { westernDigits } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData } from './ops.data';

/** A stock delta as typed: a non-zero whole number (Arabic-Indic digits allowed), else null. */
export function parseDelta(v: string): number | null {
  const t = westernDigits(v).trim();
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number.parseInt(t, 10);
  return n === 0 ? null : n;
}

export function movementReason(reason: string): string {
  switch (reason) {
    case 'sale':
      return $localize`:@@store.admin.reason-sale:بيع`;
    case 'restock':
      return $localize`:@@store.admin.reason-restock:توريد`;
    case 'adjustment':
      return $localize`:@@store.admin.reason-adjustment:تسوية جرد`;
    case 'return':
      return $localize`:@@store.admin.reason-return:مرتجع`;
    default:
      return reason;
  }
}

/** Print stock (#78–#80, FR-S43, RUL-30): on hand, reserved, available, low flags; movements and restock / adjustment. */
@Component({
  selector: 'ta-admin-stock',
  imports: [ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock.page.html',
  styleUrls: ['../admin-common.css', './stock.page.css'],
})
export class StockPage {
  protected readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly rows = computed(() => valueOf(this.data.stock) ?? []);
  protected readonly canMove = computed(() => this.auth.can('staff:stock'));
  protected readonly openId = signal<string | null>(null);
  protected readonly moves = signal<StockMovement[]>([]);
  protected readonly form = signal({ delta: '', reason: 'restock', note: '' });
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly int = toInt;
  protected readonly reasonLabel = movementReason;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-stock:المخزون`,
      description: '',
      path: '/admin/stock',
      noindex: true,
    });
    this.data.stock.reload();
  }

  protected setLow(e: Event): void {
    this.data.lowOnly.set((e.target as HTMLInputElement).checked);
  }

  protected async toggle(r: StockRow): Promise<void> {
    if (this.openId() === r.formatId) {
      this.openId.set(null);
      return;
    }
    this.openId.set(r.formatId);
    this.form.set({ delta: '', reason: 'restock', note: '' });
    this.error.set(null);
    await this.loadMoves(r.formatId);
  }

  private async loadMoves(formatId: string): Promise<void> {
    try {
      this.moves.set((await this.data.movements(formatId)).items);
    } catch {
      this.moves.set([]);
    }
  }

  protected set(field: 'delta' | 'reason' | 'note', e: Event): void {
    const v = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.form.update((f) => ({ ...f, [field]: v }));
  }

  protected async move(r: StockRow, e: Event): Promise<void> {
    e.preventDefault();
    const delta = parseDelta(this.form().delta);
    if (delta === null) {
      this.error.set(
        $localize`:@@store.admin.delta-invalid:أدخل عددًا صحيحًا غير الصفر (سالبًا للنقص).`,
      );
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.data.move(r.formatId, {
        delta,
        reason: this.form().reason,
        note: this.form().note.trim() || null,
      });
      this.form.set({ delta: '', reason: 'restock', note: '' });
      await this.loadMoves(r.formatId);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    } finally {
      this.busy.set(false);
    }
  }
}
