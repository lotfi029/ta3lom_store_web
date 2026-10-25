import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { problemMessage } from '../../../core/api/problem-message';
import { StoreConfig } from '../../../core/api/store-config';
import { CartStore } from '../../../core/cart/cart-store';
import { CartSummary } from '../../../core/cart/cart-summary';
import { I18nService } from '../../../core/i18n/i18n';
import { ToastService } from '../../../core/ui/toast.service';
import { AmountInput } from '../../../shared/ui/amount-input/amount-input';
import { Icon } from '../../../shared/ui/icon/icon';
import {
  OPEN_AMOUNT,
  OptionPicker,
  type PickerOption,
} from '../../../shared/ui/option-picker/option-picker';
import { QtyStepper } from '../../../shared/ui/qty-stepper/qty-stepper';
import { type DonateProject, donateDraft, initialChoice } from './donate-draft';

/** Navigation state the checkout reads (C-3): the cart held other donations before "تبرع". */
export interface CheckoutNavState {
  otherDonations?: boolean;
}

/**
 * The donate box (D-W5) of a project card and of the project page: option chips (with "تبرع مفتوح" when the project
 * allows an open amount) → a quantity stepper for an option, or the amount field for the open amount; **اضافة** adds the
 * line to the cart (toast with a link + header badge), **تبرع** adds it and goes to checkout (C-3: the checkout lists
 * every line and says so when the cart already had others). Limits come from `/catalog/config` and the project's
 * `minAmount` (W-5); API problems are shown inline with their values.
 */
@Component({
  selector: 'ta-donate-box',
  imports: [OptionPicker, QtyStepper, AmountInput, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box" [class.large]="size() === 'page'">
      @if (project().options === null) {
        <div class="skel chips-skel" aria-hidden="true"></div>
      } @else if (pickerOptions().length) {
        <ta-option-picker
          [name]="idPrefix() + '-opt'"
          [legend]="legend()"
          [options]="pickerOptions()"
          [allowOpen]="project().allowOpenAmount"
          [(selected)]="choice"
        />
      }

      @if (choice() === open) {
        <ta-amount-input
          [inputId]="idPrefix() + '-amount'"
          [label]="amountLabel"
          [min]="project().minAmount"
          [max]="config.maxLineAmount()"
          [presets]="size() === 'page' ? config.amountPresets() : []"
          [(raw)]="rawAmount"
          [(touched)]="touched"
          (amountChange)="amount.set($event)"
        />
      } @else if (selectedOption()) {
        <div class="qty">
          <ta-qty-stepper
            [inputId]="idPrefix() + '-qty'"
            [label]="qtyLabel()"
            [max]="maxQuantity()"
            [(value)]="quantity"
          />
        </div>
      }

      @if (error(); as e) {
        <p class="err" role="alert">{{ e }}</p>
      }

      <div class="acts">
        <button
          type="button"
          class="btn add"
          [disabled]="!ready()"
          [attr.aria-busy]="busy() === 'add'"
          [attr.aria-label]="addLabel()"
          (click)="submit('add')"
        >
          <ta-icon name="plus" [size]="18" /><span i18n="@@store.donate.add">اضافة</span>
        </button>
        <button
          type="button"
          class="btn donate"
          [disabled]="!ready()"
          [attr.aria-busy]="busy() === 'donate'"
          [attr.aria-label]="donateLabel()"
          (click)="submit('donate')"
        >
          <ta-icon name="heart" [size]="18" /><span i18n="@@store.donate.donate">تبرع</span>
        </button>
      </div>
    </div>
  `,
  styles: `
    .box {
      display: grid;
      gap: 10px;
    }
    .chips-skel {
      block-size: 44px;
    }
    .qty {
      display: flex;
    }
    .err {
      margin: 0;
      font-size: 0.82rem;
      color: var(--c-danger);
    }
    .acts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: 44px;
      border-radius: var(--r);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .add {
      background: var(--c-surface);
      border-color: var(--c-link);
      color: var(--c-link);
    }
    .donate {
      background: var(--c-brand-strong);
      color: var(--c-on-brand);
    }
    .large .btn {
      min-block-size: 50px;
      font-size: 1.02rem;
    }
  `,
})
export class DonateBox {
  protected readonly config = inject(StoreConfig);
  private readonly cart = inject(CartStore);
  private readonly summary = inject(CartSummary);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly project = input.required<DonateProject>();
  /** Unique per box on a page (ids of the radio group and fields). */
  readonly idPrefix = input.required<string>();
  readonly size = input<'card' | 'page'>('card');

  protected readonly open = OPEN_AMOUNT;
  protected readonly amountLabel = $localize`:@@store.donate.amount-label:المبلغ`;
  protected readonly choice = linkedSignal(() => initialChoice(this.project()));
  protected readonly quantity = linkedSignal(() => (this.choice(), 1));
  protected readonly rawAmount = signal('');
  protected readonly amount = signal<string | null>(null);
  protected readonly touched = signal(false);
  protected readonly busy = signal<'add' | 'donate' | null>(null);
  protected readonly localError = signal<string | null>(null);

  protected readonly title = computed(() =>
    this.i18n.pick(this.project().titleAr, this.project().titleEn),
  );
  protected readonly legend = computed(
    () => $localize`:@@store.donate.options-legend:خيارات التبرع لمشروع ${this.title()}:title:`,
  );
  protected readonly qtyLabel = computed(() => $localize`:@@store.donate.qty-label:الكمية`);
  protected readonly addLabel = computed(
    () => $localize`:@@store.donate.add-for:اضافة تبرع لمشروع ${this.title()}:title: إلى السلة`,
  );
  protected readonly donateLabel = computed(
    () => $localize`:@@store.donate.donate-for:تبرع الآن لمشروع ${this.title()}:title:`,
  );
  protected readonly pickerOptions = computed<PickerOption[]>(() =>
    (this.project().options ?? []).map((o) => ({
      id: o.id,
      label: this.i18n.pick(o.labelAr, o.labelEn),
      amount: o.amount,
    })),
  );
  protected readonly selectedOption = computed(() =>
    (this.project().options ?? []).find((o) => o.id === this.choice()),
  );
  protected readonly maxQuantity = computed(() => this.config.maxQuantity() ?? 999);
  /** Limits come from the config: until it answers (and while a request runs) the buttons wait. */
  protected readonly ready = computed(
    () => this.config.ready() && this.project().options !== null && !this.busy(),
  );
  protected readonly error = computed(() => this.localError());

  protected async submit(mode: 'add' | 'donate'): Promise<void> {
    if (!this.ready()) return;
    this.touched.set(true);
    const res = donateDraft(this.project(), this.choice(), this.quantity(), this.amount());
    if ('error' in res) {
      this.localError.set(
        res.error === 'choose'
          ? $localize`:@@store.donate.choose:اختر أحد خيارات التبرع أولًا.`
          : $localize`:@@store.donate.amount-invalid:أدخل مبلغًا صحيحًا للتبرع.`,
      );
      return;
    }
    this.localError.set(null);
    const hadOthers = this.summary.count() > 0;
    this.busy.set(mode);
    try {
      const ok = await this.cart.add(res.draft);
      if (!ok) {
        const p = this.cart.lastProblem();
        this.localError.set(
          p ? problemMessage(p) : problemMessage({ code: 'http.error', status: 400 }),
        );
        return;
      }
      if (mode === 'donate') {
        const state: CheckoutNavState = { otherDonations: hadOthers };
        await this.router.navigateByUrl('/checkout', { state });
      } else {
        this.toast.show($localize`:@@store.donate.added:أضيف تبرعك إلى السلة.`, 'success', {
          label: $localize`:@@store.donate.view-cart:عرض السلة`,
          path: '/cart',
        });
        this.rawAmount.set('');
        this.amount.set(null);
        this.touched.set(false);
      }
    } finally {
      this.busy.set(null);
    }
  }
}
