import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { Setting } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { PlatformData } from '../platform.data';
import { Requires } from '../ui/requires';
import { SETTINGS, type SettingDef, fromInput, toInput } from './setting-kinds';

/** Store settings (#118–#119, FR-S76): one typed field per key; editing needs `staff:admin`, others read. */
@Component({
  selector: 'ta-admin-settings',
  imports: [ResourceState, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrls: ['../admin-common.css', './settings.page.css'],
})
export class SettingsPage {
  protected readonly data = inject(PlatformData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly canEdit = computed(() => this.auth.can('staff:admin'));
  private readonly byKey = computed(
    () => new Map((valueOf(this.data.settings) ?? []).map((s) => [s.key, s] as const)),
  );
  protected readonly rows = computed(() =>
    SETTINGS.filter((d) => this.byKey().has(d.key)).map((d) => ({
      def: d,
      setting: this.byKey().get(d.key) as Setting,
    })),
  );
  /** Edited values by key (input text or checkbox state). */
  protected readonly draft = signal<Record<string, string | boolean>>({});
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly saving = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-settings:الإعدادات`,
      description: '',
      path: '/admin/settings',
      noindex: true,
    });
    effect(() => {
      const rows = this.rows();
      untracked(() =>
        this.draft.set(
          Object.fromEntries(rows.map((r) => [r.def.key, toInput(r.def.kind, r.setting.value)])),
        ),
      );
    });
  }

  protected value(key: string): string | boolean {
    return this.draft()[key] ?? '';
  }

  protected onInput(key: string, event: Event): void {
    const el = event.target as HTMLInputElement;
    this.draft.update((d) => ({ ...d, [key]: el.type === 'checkbox' ? el.checked : el.value }));
    this.errors.update((e) => ({ ...e, [key]: '' }));
  }

  protected async save(def: SettingDef): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    const parsed = fromInput(def, this.value(def.key));
    if ('error' in parsed) {
      this.errors.update((e) => ({ ...e, [def.key]: parsed.error }));
      return;
    }
    this.saving.set(def.key);
    try {
      await this.data.saveSetting(def.key, parsed.value);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (e) {
      this.errors.update((x) => ({ ...x, [def.key]: problemMessage(toProblem(e)) }));
    } finally {
      this.saving.set(null);
    }
  }
}
