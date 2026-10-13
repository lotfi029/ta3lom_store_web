import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SeoService } from '../../../core/seo/seo.service';
import { OtpSignIn } from './otp-sign-in';

/** A same-site path to return to after sign-in; anything else (absolute, protocol-relative) falls back. */
export function safeReturnUrl(value: string | null | undefined, fallback = '/account/courses'): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}

/** `/login` (FR-S21): OTP sign-in, then back to `returnUrl`. Client-rendered, guest only, noindex. */
@Component({
  selector: 'ta-login-page',
  imports: [OtpSignIn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph">
      <div class="wrap">
        <h1 i18n="@@store.login.title">تسجيل الدخول</h1>
        <p i18n="@@store.login.lede">برقم جوالك فقط — نرسل لك رمزًا برسالة نصية. أول دخول ينشئ حسابك تلقائيًا.</p>
      </div>
    </div>
    <section class="login">
      <div class="wrap">
        <div class="card">
          <ta-otp-sign-in (signedIn)="done()" />
        </div>
      </div>
    </section>
  `,
  styles: `
    .login {
      padding-block: 40px 80px;
    }
    .card {
      max-inline-size: 460px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 30px 70px var(--c-header-shadow);
    }
    @media (width < 480px) {
      .card {
        padding: 20px;
      }
    }
  `,
})
export class LoginPage {
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  readonly returnUrl = input<string>();

  constructor() {
    this.seo.set({
      title: $localize`:@@store.login.title:تسجيل الدخول`,
      description: $localize`:@@store.login.lede:برقم جوالك فقط — نرسل لك رمزًا برسالة نصية. أول دخول ينشئ حسابك تلقائيًا.`,
      path: '/login',
      noindex: true,
    });
  }

  protected done(): void {
    void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
  }
}
