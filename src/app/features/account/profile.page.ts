import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import {
  type AddressModel,
  addressLine,
  addressRules,
  emptyAddress,
  fromAddress,
  toAddressInput,
} from '../../core/address/address';
import type { Address } from '../../core/api/api.types';
import { problemMessage } from '../../core/api/problem-message';
import { toProblem } from '../../core/api/problem';
import { StoreAuth } from '../../core/auth/store-auth';
import { EMAIL } from '../../core/forms/patterns';
import { saveFile } from '../../core/http/save-file';
import { valueOf } from '../../core/http/resource-value';
import { I18nService } from '../../core/i18n/i18n';
import { SeoService } from '../../core/seo/seo.service';
import { ToastService } from '../../core/ui/toast.service';
import { AddressFields } from '../../shared/ui/address-fields/address-fields';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { AccountData } from './account.data';

interface ProfileModel {
  fullName: string;
  email: string;
  locale: 'ar' | 'en';
  marketingOptIn: boolean;
}

/** The word typed to confirm account deletion (10 §10). */
export const deleteWord = (): string => $localize`:@@store.account.delete-word:حذف`;

/**
 * Profile (FR-S22, FR-S27, FR-S28): name, email, language, marketing consent (#21/#22); the address book (#23–#27);
 * data rights — export (#38) and delete with a typed confirmation (#39, RUL-61); sign out on all devices (#20).
 */
@Component({
  selector: 'ta-account-profile',
  imports: [FormField, AddressFields, Dialog, Icon, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css',
})
export class ProfilePage {
  protected readonly data = inject(AccountData);
  private readonly auth = inject(StoreAuth);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  // Profile
  protected readonly model = signal<ProfileModel>({
    fullName: '',
    email: '',
    locale: 'ar',
    marketingOptIn: false,
  });
  protected readonly f = form(this.model, (p) => {
    required(p.fullName, {
      message: $localize`:@@store.checkout.name-required:أدخل الاسم الكامل.`,
    });
    validate(p.fullName, ({ value }) =>
      value().trim().length > 0 && (value().trim().length < 2 || value().trim().length > 100)
        ? {
            kind: 'length',
            message: $localize`:@@store.account.name-length:الاسم من 2 إلى 100 حرف.`,
          }
        : undefined,
    );
    validate(p.email, ({ value }) =>
      value() && !EMAIL.test(value().trim())
        ? {
            kind: 'email',
            message: $localize`:@@store.checkout.email-invalid:بريد إلكتروني غير صحيح.`,
          }
        : undefined,
    );
  });
  protected readonly saving = signal(false);
  protected readonly profileError = signal<string | null>(null);

  // Addresses
  protected readonly addresses = computed(() => valueOf(this.data.addresses) ?? []);
  /** null = no editor open; 'new' = adding; otherwise the id being edited. */
  protected readonly editing = signal<string | null>(null);
  protected readonly addr = signal<AddressModel>(emptyAddress());
  protected readonly af = form(this.addr, (p) => addressRules(p));
  protected readonly addrBusy = signal(false);
  protected readonly addrError = signal<string | null>(null);
  protected readonly line = addressLine;

  // Data rights
  protected readonly deleteOpen = signal(false);
  protected readonly typed = signal('');
  protected readonly word = deleteWord();
  protected readonly canDelete = computed(() => this.typed().trim() === this.word);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly exporting = signal(false);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.tab-profile:الملف الشخصي`,
      description: $localize`:@@store.account.seo-description:حسابك في متجر جمعية التعلم الإلكتروني.`,
      path: '/account/profile',
      noindex: true,
    });
    this.data.profile.reload();
    this.data.addresses.reload();
    effect(() => {
      const p = valueOf(this.data.profile);
      if (!p) return;
      untracked(() =>
        this.model.set({
          fullName: p.fullName ?? '',
          email: p.email ?? '',
          locale: p.locale === 'en' ? 'en' : 'ar',
          marketingOptIn: p.marketingOptIn,
        }),
      );
    });
  }

  protected setLocale(locale: 'ar' | 'en'): void {
    this.model.update((m) => ({ ...m, locale }));
  }

  protected setMarketing(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.model.update((m) => ({ ...m, marketingOptIn: checked }));
  }

  protected async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    this.f().markAsTouched();
    if (this.f().invalid() || this.saving()) return;
    this.saving.set(true);
    this.profileError.set(null);
    const m = this.model();
    try {
      await this.data.updateProfile({
        fullName: m.fullName.trim(),
        email: m.email.trim() || null,
        locale: m.locale,
        marketingOptIn: m.marketingOptIn,
        anonymousDefault: null,
        pdplConsent: null,
      });
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (e) {
      this.profileError.set(problemMessage(toProblem(e)));
    } finally {
      this.saving.set(false);
    }
  }

  protected startAdd(): void {
    this.addr.set(emptyAddress());
    this.addrError.set(null);
    this.editing.set('new');
  }

  protected startEdit(a: Address): void {
    this.addr.set(fromAddress(a));
    this.addrError.set(null);
    this.editing.set(a.id);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected async saveAddress(event: Event): Promise<void> {
    event.preventDefault();
    this.af().markAsTouched();
    if (this.af().invalid() || this.addrBusy()) {
      queueMicrotask(() =>
        document.querySelector<HTMLElement>('.addr-form [aria-invalid="true"]')?.focus(),
      );
      return;
    }
    const id = this.editing();
    this.addrBusy.set(true);
    this.addrError.set(null);
    try {
      await this.data.saveAddress(id === 'new' ? null : id, toAddressInput(this.addr()));
      this.editing.set(null);
      this.toast.show($localize`:@@store.account.address-saved:حُفظ العنوان.`, 'success');
    } catch (e) {
      this.addrError.set(problemMessage(toProblem(e)));
    } finally {
      this.addrBusy.set(false);
    }
  }

  protected async removeAddress(a: Address): Promise<void> {
    if (this.addrBusy()) return;
    this.addrBusy.set(true);
    try {
      await this.data.deleteAddress(a.id);
      this.toast.show($localize`:@@store.account.address-deleted:حُذف العنوان.`, 'success');
    } catch (e) {
      this.addrError.set(problemMessage(toProblem(e)));
    } finally {
      this.addrBusy.set(false);
    }
  }

  protected async makeDefault(a: Address): Promise<void> {
    if (this.addrBusy()) return;
    this.addrBusy.set(true);
    try {
      await this.data.setDefaultAddress(a.id);
    } catch (e) {
      this.addrError.set(problemMessage(toProblem(e)));
    } finally {
      this.addrBusy.set(false);
    }
  }

  protected async exportData(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      saveFile(await this.data.exportData(), 'ta3lom-store-export.json');
    } catch (e) {
      this.toast.show(problemMessage(toProblem(e)), 'error');
    } finally {
      this.exporting.set(false);
    }
  }

  protected async logoutAll(): Promise<void> {
    try {
      await this.auth.logoutAll();
    } finally {
      this.toast.show(
        $localize`:@@store.account.signed-out-all:سجّلنا خروجك من جميع الأجهزة.`,
        'success',
      );
      await this.router.navigateByUrl('/');
    }
  }

  protected openDelete(): void {
    this.typed.set('');
    this.deleteError.set(null);
    this.deleteOpen.set(true);
  }

  protected onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
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
