import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import type { AdminProject, MediaAsset, ProjectDetail } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StoreConfig } from '../../../core/api/store-config';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { type HasUnsavedChanges, warnBeforeUnload } from '../../../core/guards/guards';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { checkAmount } from '../../../core/money/amount';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Markdown } from '../../../shared/ui/markdown/markdown';
import { Money } from '../../../shared/ui/money/money';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { projectStatus } from '../../../shared/ui/status-pill/status-labels';
import { ConflictDialog } from '../ui/conflict-dialog';
import { Requires } from '../ui/requires';
import { CatalogAdminData } from './catalog-admin.data';
import { sortError } from './categories.page';
import { MediaPicker } from './media-picker';
import { OptionsEditor } from './options-editor';
import {
  PROJECT_SLUG,
  type ProjectModel,
  hasDonationTarget,
  missingLabel,
  optionRows,
  projectInput,
  projectModel,
} from './project-models';

const LEN = (n: number) => $localize`:@@store.admin.max-length:${n}:max: حرفًا على الأكثر.`;

/**
 * `/admin/projects/:id` (`new` = create): project details (`PUT /admin/projects/{id}`: category, slug, bilingual title,
 * summary and Markdown story, cover, open amount + minimum, badge, sort, SEO), the options editor (its own save), and
 * the status (publish with the API's `missing[]`, archive, republish, preview). Each section keeps its own unsaved
 * state; leaving with unsaved edits asks first (`canDeactivate`). Saves send `version` → 409 conflict dialog.
 */
@Component({
  selector: 'ta-admin-project-editor',
  imports: [
    FormField,
    RouterLink,
    Dialog,
    Markdown,
    Money,
    StatusPill,
    Requires,
    MediaPicker,
    OptionsEditor,
    ConflictDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-editor.page.html',
  styleUrls: ['../admin-common.css', './project-editor.page.css'],
})
export class ProjectEditorPage implements HasUnsavedChanges {
  readonly id = input.required<string>();

  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  protected readonly config = inject(StoreConfig);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  private readonly options = viewChild(OptionsEditor);

  protected readonly isNew = computed(() => this.id() === 'new');
  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly project = signal<AdminProject | null>(null);
  protected readonly loadState = signal<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  protected readonly categories = computed(() => valueOf(this.data.categories) ?? []);
  protected readonly status = computed(() => projectStatus(this.project()?.status ?? 'draft'));

  protected readonly model = signal<ProjectModel>(projectModel(null));
  private readonly initial = signal('');
  protected readonly f = form(this.model, (p) => {
    required(p.categoryId, {
      message: $localize`:@@store.admin.category-required:اختر التصنيف.`,
    });
    required(p.titleAr, { message: $localize`:@@store.admin.title-required:أدخل العنوان.` });
    validate(p.titleAr, ({ value }) =>
      value().trim() && value().trim().length < 2
        ? { kind: 'min', message: $localize`:@@store.admin.min-2:حرفان على الأقل.` }
        : undefined,
    );
    maxLength(p.titleAr, 160, { message: LEN(160) });
    maxLength(p.titleEn, 160, { message: LEN(160) });
    maxLength(p.summaryAr, 300, { message: LEN(300) });
    maxLength(p.summaryEn, 300, { message: LEN(300) });
    maxLength(p.bodyAr, 20000, { message: LEN(20000) });
    maxLength(p.bodyEn, 20000, { message: LEN(20000) });
    maxLength(p.seoTitleAr, 160, { message: LEN(160) });
    maxLength(p.seoTitleEn, 160, { message: LEN(160) });
    maxLength(p.seoDescAr, 300, { message: LEN(300) });
    maxLength(p.seoDescEn, 300, { message: LEN(300) });
    validate(p.slug, ({ value }) =>
      PROJECT_SLUG.test(value().trim())
        ? undefined
        : {
            kind: 'slug',
            message: $localize`:@@store.admin.slug-invalid:أحرف إنجليزية صغيرة وأرقام وشرطات فقط.`,
          },
    );
    validate(p.minAmount, ({ value }) =>
      !value().trim() || checkAmount(value(), null, null).ok
        ? undefined
        : {
            kind: 'amount',
            message: $localize`:@@store.admin.option-amount-invalid:أدخل مبلغًا موجبًا (مثل 50 أو 50.25).`,
          },
    );
    validate(p.sort, ({ value }) => sortError(value()));
  });
  protected readonly dirty = computed(() => JSON.stringify(this.model()) !== this.initial());
  protected readonly busy = signal<'save' | 'publish' | 'archive' | 'preview' | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly missing = signal<string[]>([]);
  protected readonly pickerOpen = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly previewOpen = signal(false);
  protected readonly preview = signal<ProjectDetail | null>(null);

  /** Publish readiness as the API reports it, plus the open-amount/options state being edited. */
  protected readonly missingNow = computed(() => this.project()?.missingForPublish ?? []);
  protected readonly noTarget = computed(() => {
    const p = this.project();
    return !!p && !hasDonationTarget(this.model().allowOpenAmount, optionRows(p.options));
  });

  constructor() {
    warnBeforeUnload(() => this.hasUnsavedChanges());
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
    this.data.categories.reload();
    this.data.media.reload();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() || !!this.options()?.hasUnsavedChanges();
  }

  private async load(id: string): Promise<void> {
    if (id === 'new') {
      this.apply(null);
      this.loadState.set('ready');
      return;
    }
    this.loadState.set('loading');
    try {
      this.apply(await this.data.project(id));
      this.loadState.set('ready');
    } catch (err) {
      this.loadState.set(toProblem(err).status === 404 ? 'notFound' : 'error');
    }
  }

  private apply(p: AdminProject | null): void {
    this.project.set(p);
    const m = projectModel(p);
    this.model.set(m);
    this.initial.set(JSON.stringify(m));
    this.error.set(null);
    this.missing.set([]);
    this.seo.set({
      title: p ? p.titleAr : $localize`:@@store.admin.new-project:مشروع جديد`,
      description: '',
      path: `/admin/projects/${this.id()}`,
      noindex: true,
    });
  }

  /** A save from another section: keep this section's unsaved edits, take the new version and readiness. */
  protected refreshed(p: AdminProject): void {
    this.project.set(p);
    this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected setFlag(key: 'allowOpenAmount', e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.model.update((m) => ({ ...m, [key]: on }));
  }

  protected setBadge(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.model.update((m) => ({ ...m, badge: v === 'new' || v === 'urgent' ? v : '' }));
  }

  protected picked(a: MediaAsset): void {
    this.model.update((m) => ({
      ...m,
      coverAssetId: a.id,
      coverUrl: a.url,
      coverAlt: this.i18n.pick(a.altAr ?? '', a.altEn),
    }));
  }

  protected clearCover(): void {
    this.model.update((m) => ({ ...m, coverAssetId: null, coverUrl: null, coverAlt: '' }));
  }

  protected discard(): void {
    this.apply(this.project());
  }

  protected async save(e: Event): Promise<void> {
    e.preventDefault();
    this.f().markAsTouched();
    if (this.f().invalid() || this.busy() || !this.canEdit()) return;
    this.busy.set('save');
    this.error.set(null);
    this.missing.set([]);
    const current = this.project();
    try {
      if (!current) {
        const created = await this.data.createProject(projectInput(this.model(), null));
        this.initial.set(JSON.stringify(this.model()));
        this.toast.show($localize`:@@store.admin.project-created:أُنشئ المشروع كمسودة.`, 'success');
        await this.router.navigate(['/admin/projects', created.id], { replaceUrl: true });
        return;
      }
      const saved = await this.data.saveProject(
        current.id,
        projectInput(this.model(), toInt(current.version)),
      );
      this.apply(saved);
      this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy.set(null);
    }
  }

  protected async transition(to: 'publish' | 'archive'): Promise<void> {
    const p = this.project();
    if (!p || this.busy() || !this.canEdit()) return;
    if (this.hasUnsavedChanges()) {
      this.error.set(
        $localize`:@@store.admin.save-first:احفظ تعديلاتك أو تجاهلها قبل تغيير حالة المشروع.`,
      );
      return;
    }
    this.busy.set(to);
    this.error.set(null);
    this.missing.set([]);
    try {
      this.apply(await this.data.transition(p.id, to));
      this.toast.show(
        to === 'publish'
          ? $localize`:@@store.admin.published:نُشر المشروع في المتجر.`
          : $localize`:@@store.admin.archived:أُرشف المشروع وأُخفي من المتجر.`,
        'success',
      );
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy.set(null);
    }
  }

  protected async openPreview(): Promise<void> {
    const p = this.project();
    if (!p || this.busy()) return;
    this.busy.set('preview');
    try {
      this.preview.set(await this.data.preview(p.id));
      this.previewOpen.set(true);
    } catch (err) {
      this.toast.show(problemMessage(toProblem(err)), 'error');
    } finally {
      this.busy.set(null);
    }
  }

  protected conflict(): void {
    this.conflictOpen.set(true);
  }

  /** Conflict → the latest version replaces every section (the edits were kept until now so they could be copied). */
  protected async reloadLatest(): Promise<void> {
    const p = this.project();
    if (!p) return;
    try {
      const latest = await this.data.project(p.id);
      this.apply(latest);
      // The options editor keeps its own rows while dirty (R-1); "load the latest" replaces them on purpose.
      this.options()?.reset(latest);
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
    }
  }

  private fail(err: unknown): void {
    const p = toProblem(err);
    if (p.code === 'concurrency.conflict') {
      this.conflictOpen.set(true);
      return;
    }
    this.error.set(problemMessage(p));
    const m = p.extra['missing'];
    if (Array.isArray(m)) this.missing.set(m.filter((x): x is string => typeof x === 'string'));
  }

  protected readonly missingLabel = missingLabel;
  protected readonly toInt = toInt;
}
