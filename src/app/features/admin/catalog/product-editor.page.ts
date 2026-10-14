import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import type {
  AdminProduct,
  MediaAsset,
  ProductCard as Card,
  StockRow,
} from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { type StoreProblem, toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { westernDigits } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { ProductCard } from '../../../shared/ui/product-card/product-card';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { CatalogAdminData } from './catalog-admin.data';
import { freshnessNotice, productStatus, productType } from './labels';
import { MediaPicker } from './media-picker';
import { MediaUpload } from './media-upload';
import {
  type FormatModel,
  type ModuleRow,
  SLUG,
  compareAtValid,
  emptyGeneral,
  formatErrors,
  fromBook,
  fromCourse,
  fromFormat,
  fromGeneral,
  fromModules,
  isInt,
  isMoney,
  newFormat,
  newModuleRow,
  previewCard,
  toBook,
  toCourse,
  toFormat,
  toGeneral,
  toModules,
} from './product-models';

type Confirm = 'publish' | 'archive' | null;

/**
 * Product editor (#55–#62, #64–#66, #80; FR-S72, RUL-01–05): general details and SEO, cover from the media library,
 * the course block and curriculum, or the book block and its formats (print stock by movements, digital file upload),
 * publish / archive with a confirmation, and a preview rendered with the store's own card. `/admin/products/new?type=`
 * creates a draft. Editing needs `staff:catalogue`; viewers see the same screen read-only, with the reason.
 */
@Component({
  selector: 'ta-admin-product-editor',
  imports: [
    FormField,
    RouterLink,
    Dialog,
    ProductCard,
    StatusPill,
    Requires,
    MediaPicker,
    MediaUpload,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-editor.page.html',
  styleUrls: ['../admin-common.css', './product-editor.page.css'],
})
export class ProductEditorPage {
  readonly id = input.required<string>();
  readonly type = input<string | undefined>();

  protected readonly data = inject(CatalogAdminData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly canEdit = computed(() => this.auth.can('staff:catalogue'));
  protected readonly canStock = computed(() => this.auth.can('staff:stock'));
  protected readonly isNew = computed(() => this.id() === 'new');
  protected readonly product = signal<AdminProduct | null>(null);
  protected readonly loadProblem = signal<StoreProblem | null>(null);
  protected readonly categories = computed(() => valueOf(this.data.categories) ?? []);
  protected readonly status = productStatus;
  protected readonly typeLabel = productType;
  protected readonly notice = freshnessNotice;

  // General
  protected readonly general = signal(emptyGeneral('course'));
  protected readonly gf = form(this.general, (p) => {
    validate(p.slug, ({ value }) =>
      SLUG.test(value().trim())
        ? undefined
        : {
            kind: 'slug',
            message: $localize`:@@store.admin.slug-invalid:أحرف إنجليزية صغيرة وأرقام وشرطات فقط.`,
          },
    );
    required(p.titleAr, {
      message: $localize`:@@store.admin.title-required:أدخل العنوان بالعربية.`,
    });
    required(p.summaryAr, {
      message: $localize`:@@store.admin.summary-required:أدخل الملخص بالعربية.`,
    });
    validate(p.sort, ({ value }) =>
      isInt(value())
        ? undefined
        : { kind: 'int', message: $localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.` },
    );
  });
  protected readonly cover = signal<MediaAsset | null>(null);
  protected readonly pickerOpen = signal(false);

  // Course
  protected readonly course = signal(toCourse({ course: null } as AdminProduct));
  protected readonly cf = form(this.course, (p) => {
    const moneyMsg = $localize`:@@store.admin.money-invalid:أدخل مبلغًا مثل 25.00`;
    const intMsg = $localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.`;
    validate(p.price, ({ value }) =>
      isMoney(value()) ? undefined : { kind: 'money', message: moneyMsg },
    );
    validate(p.compareAtPrice, ({ value, valueOf: v }) =>
      compareAtValid(v(p.price), value())
        ? undefined
        : {
            kind: 'compareAt',
            message: $localize`:@@store.admin.compare-at-invalid:السعر قبل الخصم يجب أن يكون أعلى من السعر.`,
          },
    );
    for (const f of [p.lessons, p.durationMinutes, p.learnerCount])
      validate(f, ({ value }) => (isInt(value()) ? undefined : { kind: 'int', message: intMsg }));
    validate(p.accessDays, ({ value }) =>
      !value().trim() || isInt(value(), 1) ? undefined : { kind: 'int', message: intMsg },
    );
    required(p.instructorAr, {
      message: $localize`:@@store.admin.instructor-required:أدخل اسم المدرّب.`,
    });
  });
  protected readonly modules = signal<ModuleRow[]>([]);

  // Book
  protected readonly book = signal(toBook({ book: null } as AdminProduct));
  protected readonly bf = form(this.book, (p) => {
    const intMsg = $localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.`;
    required(p.authorAr, { message: $localize`:@@store.admin.author-required:أدخل اسم المؤلف.` });
    validate(p.pages, ({ value }) =>
      !value().trim() || isInt(value(), 1) ? undefined : { kind: 'int', message: intMsg },
    );
    validate(p.publishedYear, ({ value }) =>
      !value().trim() || isInt(value(), 1900) ? undefined : { kind: 'int', message: intMsg },
    );
  });
  protected readonly formats = signal<FormatModel[]>([]);
  protected readonly formatErrors = signal<Record<string, string[]>>({});
  protected readonly stock = signal<Record<string, StockRow>>({});
  protected readonly movement = signal({ delta: '', reason: 'restock', note: '' });
  protected readonly missingKinds = computed(() =>
    (['print', 'digital'] as const).filter((k) => !this.formats().some((f) => f.kind === k)),
  );

  // Status, preview
  protected readonly busy = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly missing = signal<string[]>([]);
  protected readonly confirm = signal<Confirm>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly preview = signal<Card | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.product-title:المنتج`,
      description: '',
      path: '/admin/products',
      noindex: true,
    });
    effect(() => {
      const id = this.id();
      const type = this.type() === 'book' ? 'book' : 'course';
      untracked(() => {
        if (id === 'new') this.general.set(emptyGeneral(type));
        else void this.load(id);
      });
    });
  }

  protected async load(id: string): Promise<void> {
    this.loadProblem.set(null);
    try {
      this.apply(await this.data.product(id));
    } catch (e) {
      this.loadProblem.set(toProblem(e));
    }
  }

  private apply(p: AdminProduct): void {
    this.product.set(p);
    this.general.set(toGeneral(p));
    this.course.set(toCourse(p));
    this.modules.set(toModules(p.modules));
    this.book.set(toBook(p));
    this.formats.set(p.formats.map(toFormat));
    for (const f of p.formats) if (f.kind === 'print') void this.loadStock(f.id);
  }

  private async loadStock(formatId: string): Promise<void> {
    const row = await this.data.stockRow(formatId).catch(() => undefined);
    if (row) this.stock.update((s) => ({ ...s, [formatId]: row }));
  }

  private fail(section: string, e: unknown): void {
    const p = toProblem(e);
    this.errors.update((x) => ({ ...x, [section]: problemMessage(p) }));
    if (p.code === 'product.publish_incomplete')
      this.missing.set((p.extra['missing'] as string[] | undefined) ?? []);
  }

  private ok(section: string): void {
    this.errors.update((x) => ({ ...x, [section]: '' }));
    this.toast.show($localize`:@@store.account.saved:حُفظت التغييرات.`, 'success');
  }

  // ── general ──
  protected setSelect(field: 'categoryId' | 'badge' | 'type', e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.general.update((g) => ({ ...g, [field]: v }));
  }

  protected pickCover(a: MediaAsset): void {
    this.cover.set(a);
    this.general.update((g) => ({ ...g, coverAssetId: a.id }));
  }

  protected clearCover(): void {
    this.cover.set(null);
    this.general.update((g) => ({ ...g, coverAssetId: '' }));
  }

  protected async saveGeneral(e: Event): Promise<void> {
    e.preventDefault();
    this.gf().markAsTouched();
    if (this.gf().invalid() || this.busy()) return;
    this.busy.set('general');
    try {
      const body = fromGeneral(this.general());
      if (this.isNew()) {
        const p = await this.data.createProduct(body);
        this.toast.show($localize`:@@store.admin.created:أُنشئت المسودة.`, 'success');
        await this.router.navigate(['/admin/products', p.id], { replaceUrl: true });
      } else {
        this.apply(await this.data.saveProduct(this.id(), body));
        this.ok('general');
      }
    } catch (err) {
      this.fail('general', err);
    } finally {
      this.busy.set(null);
    }
  }

  // ── course ──
  protected async saveCourse(e: Event): Promise<void> {
    e.preventDefault();
    this.cf().markAsTouched();
    if (this.cf().invalid() || this.busy()) return;
    this.busy.set('course');
    try {
      this.apply(await this.data.saveCourse(this.id(), fromCourse(this.course())));
      this.ok('course');
    } catch (err) {
      this.fail('course', err);
    } finally {
      this.busy.set(null);
    }
  }

  protected addModule(): void {
    this.modules.update((m) => [...m, newModuleRow()]);
  }

  protected setModule(i: number, field: 'titleAr' | 'titleEn' | 'minutes', e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.modules.update((m) => m.map((r, j) => (j === i ? { ...r, [field]: v } : r)));
  }

  protected moveModule(i: number, delta: -1 | 1): void {
    this.modules.update((m) => {
      const j = i + delta;
      if (j < 0 || j >= m.length) return m;
      const next = [...m];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    queueMicrotask(() =>
      document.getElementById(`mod-${i + delta}-${delta < 0 ? 'up' : 'down'}`)?.focus(),
    );
  }

  protected removeModule(i: number): void {
    this.modules.update((m) => m.filter((_, j) => j !== i));
  }

  protected async saveModules(): Promise<void> {
    if (this.busy()) return;
    if (this.modules().some((m) => !m.titleAr.trim() || !isInt(m.minutes))) {
      this.errors.update((x) => ({
        ...x,
        modules: $localize`:@@store.admin.modules-invalid:لكل وحدة عنوان بالعربية ومدة بالدقائق.`,
      }));
      return;
    }
    this.busy.set('modules');
    try {
      this.apply(await this.data.saveModules(this.id(), fromModules(this.modules())));
      this.ok('modules');
    } catch (err) {
      this.fail('modules', err);
    } finally {
      this.busy.set(null);
    }
  }

  // ── book ──
  protected async saveBook(e: Event): Promise<void> {
    e.preventDefault();
    this.bf().markAsTouched();
    if (this.bf().invalid() || this.busy()) return;
    this.busy.set('book');
    try {
      this.apply(await this.data.saveBook(this.id(), fromBook(this.book())));
      this.ok('book');
    } catch (err) {
      this.fail('book', err);
    } finally {
      this.busy.set(null);
    }
  }

  protected addFormat(kind: 'print' | 'digital'): void {
    this.formats.update((f) => [...f, newFormat(kind, this.general().slug)]);
  }

  protected setFormat(i: number, field: keyof FormatModel, e: Event): void {
    const el = e.target as HTMLInputElement;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    this.formats.update((f) => f.map((x, j) => (j === i ? { ...x, [field]: v } : x)));
  }

  protected setFile(i: number, a: MediaAsset): void {
    this.formats.update((f) => f.map((x, j) => (j === i ? { ...x, fileAssetId: a.id } : x)));
  }

  protected fkey(f: FormatModel): string {
    return f.id ?? `new-${f.kind}`;
  }

  protected async saveFormat(i: number): Promise<void> {
    const f = this.formats()[i];
    if (!f || this.busy()) return;
    const problems = formatErrors(f);
    this.formatErrors.update((x) => ({ ...x, [this.fkey(f)]: problems }));
    if (problems.length) return;
    this.busy.set(this.fkey(f));
    try {
      if (f.id) await this.data.saveFormat(f.id, fromFormat(f));
      else await this.data.addFormat(this.id(), fromFormat(f));
      this.apply(await this.data.product(this.id()));
      this.ok(this.fkey(f));
    } catch (err) {
      this.formatErrors.update((x) => ({ ...x, [this.fkey(f)]: [problemMessage(toProblem(err))] }));
    } finally {
      this.busy.set(null);
    }
  }

  protected setMovement(field: 'delta' | 'reason' | 'note', e: Event): void {
    const v = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.movement.update((m) => ({ ...m, [field]: v }));
  }

  protected async move(formatId: string, e: Event): Promise<void> {
    e.preventDefault();
    const m = this.movement();
    const raw = westernDigits(m.delta).trim();
    if (!/^-?\d+$/.test(raw) || Number.parseInt(raw, 10) === 0) {
      this.errors.update((x) => ({
        ...x,
        stock: $localize`:@@store.admin.delta-invalid:أدخل عددًا صحيحًا غير الصفر (سالبًا للنقص).`,
      }));
      return;
    }
    if (this.busy()) return;
    this.busy.set('stock');
    try {
      const row = await this.data.moveStock(formatId, {
        delta: Number.parseInt(raw, 10),
        reason: m.reason,
        note: m.note.trim() || null,
      });
      this.stock.update((s) => ({ ...s, [formatId]: row }));
      this.movement.set({ delta: '', reason: 'restock', note: '' });
      this.ok('stock');
    } catch (err) {
      this.fail('stock', err);
    } finally {
      this.busy.set(null);
    }
  }

  protected int(v: number | string | null | undefined): number {
    return toInt(v);
  }

  // ── status, preview ──
  protected ask(kind: Confirm): void {
    this.confirm.set(kind);
    this.missing.set([]);
    this.confirmOpen.set(true);
  }

  protected async runConfirm(): Promise<void> {
    const kind = this.confirm();
    if (!kind || this.busy()) return;
    this.busy.set('status');
    try {
      this.apply(
        kind === 'publish'
          ? await this.data.publish(this.id())
          : await this.data.archive(this.id()),
      );
      this.confirmOpen.set(false);
      this.errors.update((x) => ({ ...x, status: '' }));
      this.toast.show(
        kind === 'publish'
          ? $localize`:@@store.admin.published:نُشر المنتج.`
          : $localize`:@@store.admin.archived:أُرشف المنتج.`,
        'success',
      );
    } catch (err) {
      this.confirmOpen.set(false);
      this.fail('status', err);
    } finally {
      this.busy.set(null);
    }
  }

  protected async showPreview(): Promise<void> {
    try {
      this.preview.set(previewCard(await this.data.preview(this.id())));
    } catch (err) {
      this.fail('status', err);
    }
  }
}
