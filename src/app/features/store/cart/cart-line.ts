import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { type CartLine, toInt } from '../../../core/api/api.types';
import { lineKind } from '../../../core/cart/cart-store';
import { I18nService } from '../../../core/i18n/i18n';
import { compare } from '../../../core/money/money';
import { AmountInput } from '../../../shared/ui/amount-input/amount-input';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { QtyStepper } from '../../../shared/ui/qty-stepper/qty-stepper';
import { type Limits, lineProblem } from './line-problems';

/**
 * One cart line, of three kinds (D-01): option × quantity (stepper, debounced 400 ms into one PATCH), open amount on a
 * project or amount on a category (editable amount + "Update"). Line problems are shown inline with their fix
 * (remove, or change the amount — which focuses the amount field). Presentational: the page owns the cart writes.
 */
@Component({
  selector: 'ta-cart-line',
  imports: [RouterLink, QtyStepper, AmountInput, Icon, Money],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cline" [class.bad]="problems().length > 0">
      <span class="th" aria-hidden="true"
        ><ta-icon [name]="kind() === 'category' ? 'gift' : 'heart'" [size]="26"
      /></span>
      <div class="bd">
        <div class="top">
          @if (kind() === 'category') {
            <a
              class="t"
              routerLink="/"
              [queryParams]="{ category: line().categorySlug }"
              fragment="projects"
            >
              <span i18n="@@store.cart.general-gift">تبرع عام</span> — {{ title() }}
            </a>
          } @else {
            <a class="t" [routerLink]="['/p', line().projectSlug]">{{ title() }}</a>
          }
          <span class="lp"><ta-money [value]="line().amount" /></span>
        </div>
        <div class="row">
          @if (kind() === 'option') {
            <span
              >{{ optionLabel() }} · <bdi>{{ qty() }}</bdi> × <ta-money [value]="line().unitAmount"
            /></span>
          } @else if (kind() === 'project') {
            <span i18n="@@store.donate.open-amount">تبرع مفتوح</span>
          }
        </div>
        @for (p of problems(); track p.text) {
          <p class="issue" role="alert">
            {{ p.text }}
            @if (p.fix === 'amount') {
              <button
                type="button"
                class="fixb"
                (click)="focusAmount()"
                i18n="@@store.cart.fix-amount"
              >
                تعديل المبلغ
              </button>
            }
          </p>
        }
        <div class="row acts">
          @if (kind() === 'option') {
            <ta-qty-stepper
              [inputId]="'q-' + line().id"
              [label]="qtyLabel()"
              [max]="maxQuantity()"
              [value]="qty()"
              (valueChange)="onQty($event)"
              [disabled]="busy()"
            />
          } @else {
            <div class="amt">
              <ta-amount-input
                [inputId]="'a-' + line().id"
                [label]="amountLabel()"
                [min]="kind() === 'category' ? limits().minGiftAmount : null"
                [max]="limits().maxLineAmount"
                [(raw)]="raw"
                (amountChange)="edited.set($event)"
                [disabled]="busy()"
              />
              @if (changed()) {
                <button type="button" class="upd" (click)="saveAmount()" [disabled]="busy()">
                  <span i18n="@@store.cart.update">تحديث</span
                  ><span class="visually-hidden"> {{ title() }}</span>
                </button>
              }
            </div>
          }
          <button type="button" class="rm" (click)="remove.emit()" [disabled]="busy()">
            <ta-icon name="trash" [size]="16" /><span i18n="@@store.cart.remove">حذف</span
            ><span class="visually-hidden"> {{ title() }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './cart-line.css',
})
export class CartLineView {
  private readonly i18n = inject(I18nService);
  readonly line = input.required<CartLine>();
  readonly limits = input.required<Limits>();
  readonly maxQuantity = input.required<number>();
  readonly busy = input(false);
  readonly quantity = output<number>();
  readonly amount = output<string>();
  readonly remove = output<void>();

  protected readonly kind = computed(() => lineKind(this.line()));
  protected readonly qty = computed(() => toInt(this.line().quantity, 1));
  protected readonly title = computed(() =>
    this.i18n.pick(this.line().titleAr, this.line().titleEn),
  );
  protected readonly optionLabel = computed(() =>
    this.i18n.pick(this.line().optionLabelAr ?? '', this.line().optionLabelEn),
  );
  protected readonly qtyLabel = computed(
    () => $localize`:@@store.cart.qty-for:كمية ${this.title()}:title:`,
  );
  protected readonly amountLabel = computed(
    () => $localize`:@@store.cart.amount-for:مبلغ ${this.title()}:title:`,
  );
  protected readonly problems = computed(() =>
    this.line().problems.map((code) => lineProblem(code, this.line(), this.limits())),
  );
  /** The amount field starts from the line's amount and follows it when the server changes it. */
  protected readonly raw = linkedSignal(() => this.line().amount.replace(/\.00$/, ''));
  protected readonly edited = signal<string | null>(null);
  protected readonly changed = computed(() => {
    const e = this.edited();
    return !!e && compare(e, this.line().amount) !== 0;
  });
  private readonly amountField = viewChild(AmountInput, { read: ElementRef });
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  protected onQty(q: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.quantity.emit(q), 400);
  }

  protected saveAmount(): void {
    const e = this.edited();
    if (e) this.amount.emit(e);
  }

  protected focusAmount(): void {
    (this.amountField()?.nativeElement as HTMLElement | undefined)?.querySelector('input')?.focus();
  }
}
