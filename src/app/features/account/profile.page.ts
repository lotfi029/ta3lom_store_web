import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { problemMessage } from '../../core/api/problem-message';
import { toProblem } from '../../core/api/problem';
import { EMAIL } from '../../core/forms/patterns';
import { saveFile } from '../../core/http/save-file';
import { I18nService, type Locale } from '../../core/i18n/i18n';
import { SeoService } from '../../core/seo/seo.service';
import { ToastService } from '../../core/ui/toast.service';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { AccountData } from './account.data';

interface ProfileModel {
  fullName: string;
  email: string;
  locale: Locale;
  marketingOptIn: boolean;
}

/**
 * `/account/profile` (W-M4): name, e-mail, message language and marketing consent (`PATCH /v1/me`); data export as a JSON
 * download (`GET /v1/me/export`); sign out everywhere (refresh, then `logout-all`); delete the account behind a typed
 * confirmation (`DELETE /v1/me` — anonymises the donor, keeps the donations; then signed out and the cart cleared).
 */
@Component({
  selector: 'ta-profile-page',
  imports: [Dialog, Icon, ResourceState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css',
})
export class ProfilePage {
  protected readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly model = signal<ProfileModel>({
    fullName: '',
    email: '',
    locale: 'ar',
    marketingOptIn: false,
  });
  protected readonly touched = signal(false);
  protected readonly saving = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly exporting = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly typed = signal('');
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  /** The word to type to confirm the deletion. */
  protected readonly word = $localize`:@@store.account.delete-word:حذف`;
  protected readonly canDelete = computed(() => this.typed().trim() === this.word);
  protected readonly emailError = computed(() => {
    const e = this.model().email.trim();
    return this.touched() && e && !EMAIL.test(e)
      ? $localize`:@@store.checkout.email-invalid:بريد إلكتروني غير صحيح.`
      : null;
  });

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.tab-profile:الملف الشخصي`,
      description: $localize`:@@store.account.tab-profile:الملف الشخصي`,
      path: '/account/profile',
      noindex: true,
    });
    effect(() => {
      const me = this.data.me();
      if (!me) return;
      untracked(() =>
        this.model.set({
          fullName: me.fullName ?? '',
          email: me.email ?? '',
          locale: me.locale === 'en' ? 'en' : 'ar',
          marketingOptIn: me.marketingOptIn,
        }),
      );
    });
  }

  protected set<K extends keyof ProfileModel>(key: K, value: ProfileModel[K]): void {
    this.model.update((m) => ({ ...m, [key]: value }));
  }

  protected text(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.touched.set(true);
    if (this.emailError() || this.saving()) return;
    const m = this.model();
    this.saving.set(true);
    this.profileError.set(null);
    try {
      // "" clears a field (the API's rule); the e-mail is stored lower-case.
      await this.data.updateMe({
        fullName: m.fullName.trim(),
        email: m.email.trim().toLowerCase(),
        locale: m.locale,
        marketingOptIn: m.marketingOptIn,
      });
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (e) {
      this.profileError.set(problemMessage(toProblem(e)));
    } finally {
      this.saving.set(false);
    }
  }

  protected async exportData(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      saveFile(await this.data.exportData(), 'ta3lom-donations-export.json');
    } catch (e) {
      this.toast.show(problemMessage(toProblem(e)), 'error');
    } finally {
      this.exporting.set(false);
    }
  }

  protected async logoutAll(): Promise<void> {
    try {
      await this.data.logoutAll();
      this.toast.show(
        $localize`:@@store.account.signed-out-all:سجّلنا خروجك من جميع الأجهزة.`,
        'success',
      );
    } catch (e) {
      // Not revoked everywhere (this device is signed out regardless) — never claim success.
      this.toast.show(problemMessage(toProblem(e)), 'error');
    } finally {
      await this.router.navigateByUrl('/');
    }
  }

  protected openDelete(): void {
    this.typed.set('');
    this.deleteError.set(null);
    this.deleteOpen.set(true);
  }

  protected async confirmDelete(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canDelete() || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.data.deleteAccount();
      this.deleteOpen.set(false);
      this.toast.show($localize`:@@store.account.deleted:حُذف حسابك.`, 'success');
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.deleteError.set(problemMessage(toProblem(e)));
    } finally {
      this.deleting.set(false);
    }
  }
}
