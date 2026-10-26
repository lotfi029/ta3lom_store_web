import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import type { StaffSessionResponse } from '../../../core/api/api.types';
import { passwordReason, problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { LangSwitch } from '../../../layout/lang-switch/lang-switch';
import { ThemeToggle } from '../../../layout/theme-toggle/theme-toggle';
import { Icon } from '../../../shared/ui/icon/icon';

interface PasswordModel {
  current: string;
  next: string;
  confirm: string;
}

/** What the page shows for a failed change: a message, the weak-password reasons, and whether to sign in again. */
export interface PasswordOutcome {
  message: string;
  reasons: string[];
  field: 'current' | 'next' | null;
  signIn: boolean;
}

/** `POST /admin/auth/password` failures (contract 15 §2.6) → what the form shows. */
export function passwordOutcome(error: unknown): PasswordOutcome {
  const p = toProblem(error);
  const reasons = Array.isArray(p.extra['reasons'])
    ? (p.extra['reasons'] as unknown[]).filter((r): r is string => typeof r === 'string')
    : [];
  return {
    message: problemMessage(p),
    reasons: p.code === 'auth.password_weak' ? reasons.map(passwordReason) : [],
    field:
      p.code === 'auth.current_password_invalid'
        ? 'current'
        : p.code === 'auth.password_weak'
          ? 'next'
          : null,
    // Inactive member or an expired session: the change can only be retried after signing in again.
    signIn: p.status === 401 || p.code === 'auth.account_locked',
  };
}

/**
 * `POST /admin/auth/password`, retried once after a 401 (F-5): the staff access token lives 10 minutes, so a staff member who
 * reads the rules for a while gets 401 on submit. The refresh cookie still works — refresh (the new token may still
 * carry `pwd_change`, which this route accepts) and send the same change again. A second 401, or a failed refresh,
 * reaches the page, which signs out.
 */
export async function changePasswordWithRefresh(
  auth: StaffAuth,
  current: string,
  next: string,
): Promise<StaffSessionResponse> {
  try {
    return await auth.changePassword(current, next);
  } catch (e) {
    if (toProblem(e).status !== 401) throw e;
    await auth.refresh();
    return auth.changePassword(current, next);
  }
}

/**
 * `/admin/password` (C-6 / E-3): the forced change after a one-time password (the access token carries `pwd_change`;
 * every other admin screen redirects here, also after a reload) and the self-service change from the admin bar.
 * Success returns a fresh session (other sessions revoked); the token without the claim replaces the current one, so
 * the admin opens straight away. Strength rules are the API's (`auth.password_weak` + `reasons`).
 */
@Component({
  selector: 'ta-admin-password',
  imports: [FormField, RouterLink, LangSwitch, ThemeToggle, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-password.page.html',
  styleUrls: ['../admin-common.css', '../login/admin-login.page.css'],
})
export class AdminPasswordPage {
  protected readonly auth = inject(StaffAuth);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  /** Forced (one-time password) or self-service. */
  protected readonly forced = computed(() => this.auth.mustChangePassword());
  protected readonly model = signal<PasswordModel>({ current: '', next: '', confirm: '' });
  protected readonly f = form(this.model, (p) => {
    required(p.current, {
      message: $localize`:@@store.admin.password-current-required:أدخل كلمة المرور الحالية.`,
    });
    required(p.next, {
      message: $localize`:@@store.admin.password-new-required:أدخل كلمة المرور الجديدة.`,
    });
    validate(p.confirm, ({ value, valueOf }) =>
      value() !== valueOf(p.next)
        ? {
            kind: 'match',
            message: $localize`:@@store.admin.password-mismatch:كلمتا المرور غير متطابقتين.`,
          }
        : undefined,
    );
  });
  protected readonly busy = signal(false);
  protected readonly outcome = signal<PasswordOutcome | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.password-title:تغيير كلمة المرور`,
      description: '',
      path: '/admin/password',
      noindex: true,
    });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.f().markAsTouched();
    if (this.f().invalid() || this.busy()) return;
    this.busy.set(true);
    this.outcome.set(null);
    const { current, next } = this.model();
    try {
      await changePasswordWithRefresh(this.auth, current, next);
      this.toast.show(
        $localize`:@@store.admin.password-changed:غُيّرت كلمة المرور. أُغلقت جلساتك الأخرى.`,
        'success',
      );
      await this.router.navigateByUrl('/admin');
    } catch (e) {
      const o = passwordOutcome(e);
      this.outcome.set(o);
      if (o.signIn) {
        await this.auth.logout();
        await this.router.navigateByUrl('/admin/login');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/admin/login');
  }
}
