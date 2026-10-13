import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import type { SessionResponse } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StoreAuth } from '../../../core/auth/store-auth';
import { CartSummary } from '../../../core/cart/cart-summary';
import { normalizeSaudiMobile, westernDigits } from '../../../core/i18n/western-digits';

type Step = 'mobile' | 'code';
const RESEND_AFTER_S = 60;

/**
 * `<ta-otp-sign-in>` (10 §7.3, FR-S21, RUL-60/61): mobile → 6-digit SMS code → session. Used on /login and inline at
 * checkout. The server enforces the limits; the 60 s resend pause is UI pacing only. Focus moves to the code field when
 * the code is sent ("code sent" is announced politely); errors use role="alert". A pasted or typed 6-digit code submits
 * itself. Arabic-Indic digits are accepted everywhere.
 */
@Component({
  selector: 'ta-otp-sign-in',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp-sign-in.html',
  styleUrl: './otp-sign-in.css',
})
export class OtpSignIn {
  private readonly auth = inject(StoreAuth);
  private readonly cart = inject(CartSummary);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);

  readonly signedIn = output<SessionResponse>();

  protected readonly step = signal<Step>('mobile');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  /** The normalised `05…` number the code was sent to. */
  protected readonly sentTo = signal<string | null>(null);
  private readonly expiresAt = signal(0);
  private readonly resendAt = signal(0);
  private readonly now = signal(Date.now());

  protected readonly mobileModel = signal({ mobile: '' });
  protected readonly mobileForm = form(this.mobileModel, (p) => {
    required(p.mobile, { message: $localize`:@@store.otp.mobile-required:أدخل رقم الجوال.` });
    validate(p.mobile, ({ value }) =>
      value() && !normalizeSaudiMobile(value()) ? { kind: 'mobile', message: $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.` } : undefined,
    );
  });
  protected readonly codeModel = signal({ code: '' });
  protected readonly codeForm = form(this.codeModel, (p) => {
    validate(p.code, ({ value }) =>
      /^\d{6}$/.test(westernDigits(value()).trim()) ? undefined : { kind: 'code', message: $localize`:@@store.otp.code-format:الرمز من 6 أرقام.` },
    );
  });

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private readonly mobileInput = viewChild<ElementRef<HTMLInputElement>>('mobileInput');

  protected readonly masked = computed(() => {
    const m = this.sentTo();
    return m ? `${m.slice(0, 2)}•••••${m.slice(-3)}` : '';
  });
  protected readonly resendIn = computed(() => Math.max(0, Math.ceil((this.resendAt() - this.now()) / 1000)));
  protected readonly expiresIn = computed(() => Math.max(0, Math.ceil((this.expiresAt() - this.now()) / 1000)));
  protected readonly expiresLabel = computed(() => {
    const s = this.expiresIn();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    // Normalise as typed (Arabic-Indic digits, spaces) and submit once six digits are present (typed or pasted).
    effect(() => {
      const raw = this.codeModel().code;
      const code = westernDigits(raw).replace(/\D/g, '').slice(0, 6);
      if (code !== raw) {
        untracked(() => this.codeModel.set({ code }));
        return;
      }
      if (code.length === 6 && untracked(() => this.step() === 'code' && !this.busy())) void untracked(() => this.verify());
    });
    if (this.browser) {
      const timer = setInterval(() => this.now.set(Date.now()), 1000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  protected async requestCode(event?: Event): Promise<void> {
    event?.preventDefault();
    this.mobileForm.mobile().markAsTouched();
    const mobile = normalizeSaudiMobile(this.mobileModel().mobile);
    if (!mobile || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await this.auth.requestOtp(mobile);
      this.sentTo.set(mobile);
      this.expiresAt.set(Date.now() + toInt(res.expiresInSeconds, 300) * 1000);
      this.resendAt.set(Date.now() + RESEND_AFTER_S * 1000);
      this.now.set(Date.now());
      this.codeModel.set({ code: '' });
      this.step.set('code');
      this.status.set($localize`:@@store.otp.sent:أرسلنا رمز التحقق إلى ${this.masked()}:masked:.`);
      afterNextRender(() => this.codeInput()?.nativeElement.focus(), { injector: this.injector });
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async verify(event?: Event): Promise<void> {
    event?.preventDefault();
    const code = westernDigits(this.codeModel().code).replace(/\D/g, '');
    const mobile = this.sentTo();
    if (!mobile || code.length !== 6 || this.busy()) {
      this.codeForm.code().markAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const session = await this.auth.verifyOtp(mobile, code);
      await this.cart.load();
      this.status.set($localize`:@@store.otp.signed-in:تم تسجيل الدخول.`);
      this.signedIn.emit(session);
    } catch (err) {
      this.error.set(this.message(err));
      this.codeModel.set({ code: '' });
      this.codeInput()?.nativeElement.focus();
    } finally {
      this.busy.set(false);
    }
  }

  protected changeNumber(): void {
    this.step.set('mobile');
    this.error.set(null);
    this.status.set(null);
    afterNextRender(() => this.mobileInput()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Problem → visitor message, with the OTP specifics (attempts left, wait time). */
  private message(err: unknown): string {
    const p = toProblem(err);
    if (p.code === 'otp.invalid') {
      const left = toInt(p.extra['attemptsLeft'] as number | string | undefined, -1);
      return left >= 0
        ? $localize`:@@store.otp.invalid-left:الرمز غير صحيح. المحاولات المتبقية: ${left}:left:.`
        : problemMessage(p);
    }
    if ((p.code === 'otp.rate_limited' || p.code === 'http.rate_limited') && p.retryAfterSeconds) {
      const minutes = Math.max(1, Math.ceil(p.retryAfterSeconds / 60));
      return $localize`:@@store.otp.wait:طلبت رموزًا كثيرة. حاول مرة أخرى بعد ${minutes}:minutes: دقيقة.`;
    }
    if (p.code === 'auth.account_blocked') return $localize`:@@store.otp.blocked:لا يمكن لهذا الحساب تسجيل الدخول. تواصل مع الجمعية للمساعدة.`;
    return problemMessage(p);
  }
}
