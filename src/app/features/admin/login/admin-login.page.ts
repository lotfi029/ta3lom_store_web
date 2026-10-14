import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import type { TotpEnrolResponse } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { westernDigits } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { LangSwitch } from '../../../layout/lang-switch/lang-switch';
import { ThemeToggle } from '../../../layout/theme-toggle/theme-toggle';
import { Icon } from '../../../shared/ui/icon/icon';

type Step = 'password' | 'enrol' | 'code';

/** Only same-site admin paths are honoured after sign-in (no open redirect). */
export function safeAdminReturn(url: string | null | undefined): string {
  return url &&
    url.startsWith('/admin') &&
    !url.startsWith('/admin/login') &&
    !url.includes('//') &&
    !url.includes('\\')
    ? url
    : '/admin';
}

/** `secretBase32` in groups of four, as authenticator apps show it. */
export const groupSecret = (s: string): string =>
  s
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();

/**
 * `/admin/login` (RUL-62, FR-S70, 11 §9.1): email + password → a 5-minute MFA token → TOTP enrolment (first sign-in:
 * the setup key to type into an authenticator app) or the 6-digit code → staff session. Five failures lock the account
 * for an hour (the API's rule; its message is shown).
 */
@Component({
  selector: 'ta-admin-login',
  imports: [FormField, LangSwitch, ThemeToggle, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-login.page.html',
  styleUrls: ['../admin-common.css', './admin-login.page.css'],
})
export class AdminLoginPage {
  readonly returnUrl = input<string | undefined>();

  private readonly auth = inject(StaffAuth);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly seo = inject(SeoService);

  protected readonly step = signal<Step>('password');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enrolment = signal<TotpEnrolResponse | null>(null);
  protected readonly group = groupSecret;

  protected readonly creds = signal({ email: '', password: '' });
  protected readonly cf = form(this.creds, (p) => {
    required(p.email, {
      message: $localize`:@@store.admin.email-required:أدخل البريد الإلكتروني.`,
    });
    required(p.password, {
      message: $localize`:@@store.admin.password-required:أدخل كلمة المرور.`,
    });
  });
  protected readonly code = signal({ code: '' });
  protected readonly kf = form(this.code, (p) => {
    validate(p.code, ({ value }) =>
      /^\d{6}$/.test(westernDigits(value()).trim())
        ? undefined
        : { kind: 'code', message: $localize`:@@store.otp.code-format:الرمز من 6 أرقام.` },
    );
  });

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.login-title:دخول فريق المتجر`,
      description: $localize`:@@store.admin.login-description:دخول فريق متجر جمعية التعلم الإلكتروني.`,
      path: '/admin/login',
      noindex: true,
    });
  }

  protected async submitPassword(event: Event): Promise<void> {
    event.preventDefault();
    this.cf().markAsTouched();
    if (this.cf().invalid() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.creds();
      const res = await this.auth.login(email.trim(), password);
      if (res.totpEnrolled) {
        this.step.set('code');
      } else {
        this.enrolment.set(await this.auth.enrol());
        this.step.set('enrol');
      }
      this.code.set({ code: '' });
      afterNextRender(() => this.codeInput()?.nativeElement.focus(), { injector: this.injector });
    } catch (e) {
      this.error.set(problemMessage(toProblem(e)));
    } finally {
      this.busy.set(false);
    }
  }

  protected async submitCode(event: Event): Promise<void> {
    event.preventDefault();
    this.kf().markAsTouched();
    if (this.kf().invalid() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.verify(westernDigits(this.code().code).trim());
      await this.router.navigateByUrl(safeAdminReturn(this.returnUrl()));
    } catch (e) {
      const p = toProblem(e);
      this.error.set(problemMessage(p));
      // The MFA token lasts 5 minutes; after it expires the password step starts again.
      if (p.code === 'auth.unauthenticated' || p.code === 'auth.account_locked') this.restart();
      else this.code.set({ code: '' });
    } finally {
      this.busy.set(false);
    }
  }

  protected restart(): void {
    this.step.set('password');
    this.enrolment.set(null);
    this.creds.update((c) => ({ ...c, password: '' }));
  }
}
