import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import type { StaffUser } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { STAFF_ROLES, type StaffRole } from '../../../core/auth/policies';
import { roleLabel } from '../../../core/auth/policy-text';
import { EMAIL } from '../../../core/forms/patterns';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { PlatformData } from '../platform.data';

interface StaffModel {
  email: string;
  name: string;
  roles: StaffRole[];
  isActive: boolean;
}

type Confirm = { kind: 'password' | 'totp' | 'unlock'; user: StaffUser } | null;

/**
 * Staff accounts (#123–#128, RUL-62, FR-S71): list, create (one-time password shown once), edit name/roles/active,
 * reset password (one-time password), reset TOTP (re-enrol at next sign-in), unlock. `staff:admin` only (route guard).
 */
@Component({
  selector: 'ta-admin-staff',
  imports: [FormField, Dialog, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff.page.html',
  styleUrls: ['../admin-common.css'],
})
export class StaffPage {
  protected readonly data = inject(PlatformData);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly users = computed(() => valueOf(this.data.staff) ?? []);
  protected readonly allRoles = STAFF_ROLES;
  protected readonly roleLabel = roleLabel;

  /** null = closed; 'new' = create; otherwise the user being edited. */
  protected readonly editing = signal<StaffUser | 'new' | null>(null);
  protected readonly editOpen = signal(false);
  protected readonly model = signal<StaffModel>({ email: '', name: '', roles: [], isActive: true });
  protected readonly f = form(this.model, (p) => {
    required(p.name, { message: $localize`:@@store.admin.name-required:أدخل الاسم.` });
    required(p.email, {
      message: $localize`:@@store.admin.email-required:أدخل البريد الإلكتروني.`,
    });
    validate(p.email, ({ value }) =>
      value() && !EMAIL.test(value().trim())
        ? {
            kind: 'email',
            message: $localize`:@@store.checkout.email-invalid:بريد إلكتروني غير صحيح.`,
          }
        : undefined,
    );
    validate(p.roles, ({ value }) =>
      value().length === 0
        ? {
            kind: 'roles',
            message: $localize`:@@store.admin.roles-required:اختر دورًا واحدًا على الأقل.`,
          }
        : undefined,
    );
  });
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly confirm = signal<Confirm>(null);
  protected readonly confirmOpen = signal(false);
  /** A one-time password, shown once (create or reset). */
  protected readonly secret = signal<{ email: string; password: string } | null>(null);
  protected readonly secretOpen = signal(false);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-staff:فريق العمل`,
      description: '',
      path: '/admin/staff',
      noindex: true,
    });
  }

  protected locked(u: StaffUser): boolean {
    return !!u.lockedUntil && Date.parse(u.lockedUntil) > Date.now();
  }

  protected roles(u: StaffUser): string {
    return u.roles.map(roleLabel).join('، ');
  }

  protected startCreate(): void {
    this.model.set({ email: '', name: '', roles: [], isActive: true });
    this.formError.set(null);
    this.editing.set('new');
    this.editOpen.set(true);
  }

  protected startEdit(u: StaffUser): void {
    this.model.set({
      email: u.email,
      name: u.name,
      roles: u.roles.filter((r): r is StaffRole => (STAFF_ROLES as readonly string[]).includes(r)),
      isActive: u.isActive,
    });
    this.formError.set(null);
    this.editing.set(u);
    this.editOpen.set(true);
  }

  protected toggleRole(role: StaffRole, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.model.update((m) => ({
      ...m,
      roles: on ? [...m.roles, role] : m.roles.filter((r) => r !== role),
    }));
    this.f.roles().markAsTouched();
  }

  protected setActive(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.model.update((m) => ({ ...m, isActive: on }));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.f().markAsTouched();
    const target = this.editing();
    if (this.f().invalid() || this.busy() || !target) return;
    this.busy.set(true);
    this.formError.set(null);
    const m = this.model();
    try {
      if (target === 'new') {
        const r = await this.data.createStaff({
          email: m.email.trim(),
          name: m.name.trim(),
          roles: m.roles,
        });
        this.editOpen.set(false);
        this.showSecret(r.staff.email, r.oneTimePassword);
      } else {
        await this.data.updateStaff(target.id, {
          name: m.name.trim(),
          roles: m.roles,
          isActive: m.isActive,
        });
        this.editOpen.set(false);
        this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
      }
    } catch (e) {
      this.formError.set(problemMessage(toProblem(e)));
    } finally {
      this.busy.set(false);
    }
  }

  protected ask(kind: 'password' | 'totp' | 'unlock', user: StaffUser): void {
    this.confirm.set({ kind, user });
    this.confirmOpen.set(true);
  }

  protected async run(): Promise<void> {
    const c = this.confirm();
    if (!c || this.busy()) return;
    this.busy.set(true);
    try {
      if (c.kind === 'password') {
        const r = await this.data.resetPassword(c.user.id);
        this.confirmOpen.set(false);
        this.showSecret(c.user.email, r.oneTimePassword);
      } else if (c.kind === 'totp') {
        await this.data.resetTotp(c.user.id);
        this.confirmOpen.set(false);
        this.toast.show(
          $localize`:@@store.admin.totp-reset:سيُطلب إعداد التحقق بخطوتين عند الدخول التالي.`,
          'success',
        );
      } else {
        await this.data.unlock(c.user.id);
        this.confirmOpen.set(false);
        this.toast.show($localize`:@@store.admin.unlocked:أُلغي قفل الحساب.`, 'success');
      }
    } catch (e) {
      this.confirmOpen.set(false);
      this.toast.show(problemMessage(toProblem(e)), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected confirmText(): string {
    const c = this.confirm();
    if (!c) return '';
    switch (c.kind) {
      case 'password':
        return $localize`:@@store.admin.confirm-password:ستُلغى كلمة مرور ${c.user.email}:email: الحالية وتظهر كلمة مرور مؤقتة مرة واحدة.`;
      case 'totp':
        return $localize`:@@store.admin.confirm-totp:سيُطلب من ${c.user.email}:email: إعداد التحقق بخطوتين من جديد عند الدخول التالي.`;
      default:
        return $localize`:@@store.admin.confirm-unlock:سيتمكن ${c.user.email}:email: من الدخول مجددًا.`;
    }
  }

  private showSecret(email: string, password: string): void {
    this.secret.set({ email, password });
    this.secretOpen.set(true);
  }

  protected closeSecret(): void {
    this.secretOpen.set(false);
    this.secret.set(null);
  }
}
