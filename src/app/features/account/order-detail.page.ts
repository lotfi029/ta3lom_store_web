import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { OrderDetail, OrderDocument, OrderLine } from '../../core/api/api.types';
import { toInt } from '../../core/api/api.types';
import { problemMessage } from '../../core/api/problem-message';
import { type StoreProblem, toProblem } from '../../core/api/problem';
import { saveFile } from '../../core/http/save-file';
import { I18nService } from '../../core/i18n/i18n';
import { isZero } from '../../core/money/money';
import { SeoService } from '../../core/seo/seo.service';
import { Icon } from '../../shared/ui/icon/icon';
import { Money } from '../../shared/ui/money/money';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { AccountData } from './account.data';
import { documentKind, orderStatus, shipmentStatus } from './labels';

/** One order (FR-S26, #36): purchase lines, totals, payments, shipment, and invoice PDFs (#37, RUL-59). r4: purchases only. */
@Component({
  selector: 'ta-account-order',
  imports: [RouterLink, Icon, Money, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.css',
})
export class OrderDetailPage {
  readonly ref = input.required<string>();

  private readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly problem = signal<StoreProblem | null>(null);
  protected readonly docError = signal<string | null>(null);
  protected readonly busyDoc = signal<string | null>(null);

  protected readonly lines = computed(() =>
    (this.order()?.lines ?? []).filter((l) => l.kind === 'buy'),
  );
  protected readonly documents = computed(() =>
    (this.order()?.documents ?? []).filter((d) => d.kind === 'invoice' || d.kind === 'credit_note'),
  );
  protected readonly status = orderStatus;
  protected readonly shipStatus = shipmentStatus;
  protected readonly docKind = documentKind;
  protected readonly isZero = isZero;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.order-title:تفاصيل الطلب`,
      description: $localize`:@@store.account.seo-description:حسابك في متجر جمعية التعلم الإلكتروني.`,
      path: '/account/orders',
      noindex: true,
    });
    effect(() => void this.load(this.ref()));
  }

  protected async load(ref: string): Promise<void> {
    if (!this.browser) return;
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

  protected qty(l: OrderLine): number {
    return toInt(l.quantity, 1);
  }

  protected formatLabel(l: OrderLine): string | null {
    if (l.format === 'print') return $localize`:@@store.card.format-print:نسخة مطبوعة`;
    if (l.format === 'digital') return $localize`:@@store.card.format-digital:نسخة رقمية PDF`;
    return null;
  }

  protected notFound(): boolean {
    const p = this.problem();
    return !!p && (p.status === 404 || p.code === 'order.not_found');
  }

  protected errorText(): string {
    const p = this.problem();
    return p ? problemMessage(p) : '';
  }

  protected async download(d: OrderDocument): Promise<void> {
    if (!d.ready || this.busyDoc()) return;
    this.busyDoc.set(d.number);
    this.docError.set(null);
    try {
      saveFile(await this.data.document(d.number), `${d.number}.pdf`);
    } catch (e) {
      this.docError.set(problemMessage(toProblem(e)));
    } finally {
      this.busyDoc.set(null);
    }
  }
}
