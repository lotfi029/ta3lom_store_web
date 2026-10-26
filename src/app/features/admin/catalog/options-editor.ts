import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { AdminProject } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { I18nService } from '../../../core/i18n/i18n';
import { CatalogAdminData } from './catalog-admin.data';
import {
  MAX_OPTIONS,
  type OptionField,
  type OptionRow,
  missingLabel,
  newOptionRow,
  optionProblemText,
  optionProblems,
  optionRows,
  optionsInput,
} from './project-models';

/**
 * Donation options of a project (`PUT /admin/projects/{id}/options`, a full replacement): add, rename, change the
 * amount, reorder (up/down), deactivate or remove. A removed option that already has donations is deactivated by the
 * API instead of deleted. Rows are checked here first, next to the field (the API checks again). Saves send `version`; a
 * 409 `concurrency.conflict` is handed to the page (`conflict`).
 */
@Component({
  selector: 'ta-options-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './options-editor.html',
  styleUrls: ['../admin-common.css', './options-editor.css'],
})
export class OptionsEditor {
  private readonly data = inject(CatalogAdminData);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly i18n = inject(I18nService);

  readonly project = input.required<AdminProject>();
  readonly canEdit = input(false);
  readonly saved = output<AdminProject>();
  readonly conflict = output<void>();

  protected readonly rows = signal<OptionRow[]>([]);
  private readonly initial = signal('');
  protected readonly tried = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly missing = signal<string[]>([]);
  protected readonly announcement = signal('');
  protected readonly max = MAX_OPTIONS;

  protected readonly problems = computed(() => optionProblems(this.rows()));
  protected readonly dirty = computed(() => JSON.stringify(this.rows()) !== this.initial());

  constructor() {
    // A new project version (load, save, conflict reload) resets the rows.
    effect(() => {
      const p = this.project();
      untracked(() => this.reset(p));
    });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  private reset(p: AdminProject): void {
    const rows = optionRows(p.options);
    this.rows.set(rows);
    this.initial.set(JSON.stringify(rows));
    this.tried.set(false);
    this.error.set(null);
    this.missing.set([]);
  }

  protected problemFor(key: string, field: OptionField): string | null {
    if (!this.tried()) return null;
    const p = this.problems().find((x) => x.key === key && x.field === field);
    return p ? optionProblemText(p) : null;
  }

  protected listProblem(): string | null {
    const p = this.problems().find((x) => x.key === null);
    return p ? optionProblemText(p) : null;
  }

  protected set(key: string, field: OptionField, e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.rows.update((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: v } : r)));
  }

  protected setActive(key: string, e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.rows.update((rs) => rs.map((r) => (r.key === key ? { ...r, isActive: on } : r)));
  }

  protected add(): void {
    const row = newOptionRow();
    this.rows.update((rs) => [...rs, row]);
    this.focus(`[data-key="${row.key}"] input`);
  }

  protected remove(key: string): void {
    const i = this.rows().findIndex((r) => r.key === key);
    this.rows.update((rs) => rs.filter((r) => r.key !== key));
    this.announcement.set($localize`:@@store.admin.option-removed:أُزيل الخيار من القائمة.`);
    const next = this.rows()[Math.min(i, this.rows().length - 1)];
    this.focus(next ? `[data-key="${next.key}"] input` : 'button.add');
  }

  protected move(key: string, by: -1 | 1): void {
    const rs = [...this.rows()];
    const i = rs.findIndex((r) => r.key === key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= rs.length) return;
    [rs[i], rs[j]] = [rs[j], rs[i]];
    this.rows.set(rs);
    this.announcement.set(
      $localize`:@@store.admin.option-moved:نُقل الخيار إلى الموضع ${j + 1}:position: من ${rs.length}:count:.`,
    );
    this.focus(`[data-key="${key}"] button[data-move="${by < 0 ? 'up' : 'down'}"]`);
  }

  protected discard(): void {
    this.reset(this.project());
  }

  protected async save(e: Event): Promise<void> {
    e.preventDefault();
    this.tried.set(true);
    if (this.problems().length || this.busy() || !this.canEdit()) {
      if (this.problems().length) this.focus('[aria-invalid="true"]');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.missing.set([]);
    const p = this.project();
    try {
      const fresh = await this.data.saveOptions(p.id, optionsInput(this.rows(), toInt(p.version)));
      this.saved.emit(fresh);
    } catch (err) {
      const prob = toProblem(err);
      if (prob.code === 'concurrency.conflict') {
        this.conflict.emit();
        return;
      }
      this.error.set(problemMessage(prob));
      const m = prob.extra['missing'];
      if (Array.isArray(m)) this.missing.set(m.filter((x): x is string => typeof x === 'string'));
    } finally {
      this.busy.set(false);
    }
  }

  protected readonly missingLabel = missingLabel;

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
