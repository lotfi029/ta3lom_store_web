import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { type Params, Router } from '@angular/router';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import type { IconName } from '../../../shared/ui/icon/icon.data';
import { ADMIN_SECTIONS, visibleNav } from './admin-nav';
import { AdminShellData } from './admin-shell.data';
import { paletteTarget } from './palette-target';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  url: string;
  queryParams?: Params;
}

/**
 * Ctrl/⌘ K (docs/admin-redesign/03 §3): an ARIA combobox (input + listbox, `aria-activedescendant`) in the shared
 * dialog. Screens and actions are filtered here; a reference opens the donation, a mobile searches donations, other
 * text also searches projects (5 at most). Only screens the user may read are offered.
 */
@Component({
  selector: 'ta-command-palette',
  imports: [Dialog, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-dialog [(open)]="open" labelledBy="cp-title" (closed)="reset()">
      <div class="cp">
        <h2 id="cp-title" class="visually-hidden" i18n="@@store.admin.palette-title">بحث سريع</h2>
        <div class="cp-field">
          <ta-icon name="search" [size]="20" />
          <label class="visually-hidden" for="cp-q" i18n="@@store.admin.palette-label"
            >ابحث برقم التبرع أو الجوال أو اسم المشروع أو الشاشة</label
          >
          <input
            #input
            id="cp-q"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="cp-list"
            [attr.aria-activedescendant]="activeId()"
            placeholder="ابحث برقم التبرع أو الجوال أو اسم المشروع"
            i18n-placeholder="@@store.admin.search-placeholder"
            [value]="query()"
            (input)="type($event)"
            (keydown)="key($event)"
          />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <ul id="cp-list" role="listbox" aria-labelledby="cp-title">
          @for (item of items(); track item.id; let i = $index) {
            <!-- Options are reached through the input (aria-activedescendant), so they take no focus or keys of their own. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              role="option"
              [id]="'cp-o-' + i"
              [attr.aria-selected]="i === active()"
              [class.on]="i === active()"
              (click)="go(item)"
              (pointermove)="active.set(i)"
            >
              <ta-icon [name]="item.icon" [size]="18" />
              <span class="l">{{ item.label }}</span>
              @if (item.hint) {
                <small>{{ item.hint }}</small>
              }
            </li>
          } @empty {
            <li class="none" role="presentation" i18n="@@store.admin.palette-none">لا نتائج.</li>
          }
        </ul>
        <p class="status" aria-live="polite">
          @if (searching()) {
            <ng-container i18n="@@store.admin.palette-searching"
              >جارٍ البحث في المشاريع…</ng-container
            >
          }
        </p>
      </div>
    </ta-dialog>
  `,
  styles: `
    .cp {
      display: grid;
      background: var(--c-surface);
      color: var(--c-text);
      max-inline-size: 640px;
    }
    .cp-field {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-inline: 16px;
      border-block-end: 1px solid var(--c-border);
      color: var(--c-muted);
    }
    input {
      flex: 1;
      min-block-size: 56px;
      border: 0;
      background: none;
      color: var(--c-text);
      font: inherit;
      font-size: 1rem;
    }
    input:focus {
      outline: none;
    }
    .cp-field:focus-within {
      box-shadow: inset 0 -2px 0 var(--c-focus);
    }
    kbd {
      font-family: var(--fe);
      font-size: 0.72rem;
      border: 1px solid var(--c-border);
      border-radius: 6px;
      padding-inline: 6px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 8px;
      max-block-size: min(60vh, 420px);
      overflow-y: auto;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding-inline: 12px;
      border-radius: 10px;
      cursor: pointer;
    }
    li {
      border-inline-start: 3px solid transparent;
    }
    li.on {
      background: var(--c-admin-row-selected);
      border-inline-start-color: var(--c-focus);
    }
    li small {
      margin-inline-start: auto;
      color: var(--c-muted);
      font-size: 0.78rem;
    }
    li.none {
      cursor: default;
      color: var(--c-muted);
    }
    .l {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status {
      margin: 0;
      padding-inline: 16px;
      padding-block-end: 8px;
      font-size: 0.8rem;
      color: var(--c-muted);
      min-block-size: 1em;
    }
  `,
})
export class CommandPalette {
  private readonly auth = inject(StaffAuth);
  private readonly router = inject(Router);
  private readonly shell = inject(AdminShellData);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly open = model(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly screens = computed<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    for (const s of visibleNav((p) => this.auth.can(p), ADMIN_SECTIONS))
      for (const i of s.items) {
        out.push({
          id: `nav-${i.key}`,
          label: i.label(),
          icon: i.icon,
          url: i.path,
          queryParams: i.queryParams,
        });
        for (const c of i.children ?? [])
          if (c.key !== `${i.key}-all`)
            out.push({
              id: `nav-${c.key}`,
              label: c.label(),
              hint: i.label(),
              icon: c.icon,
              url: c.path,
              queryParams: c.queryParams,
            });
      }
    if (this.auth.can('staff:catalogue'))
      out.push({
        id: 'act-new-project',
        label: $localize`:@@store.admin.new-project:مشروع جديد`,
        icon: 'plus',
        url: '/admin/projects/new',
      });
    out.push({
      id: 'act-password',
      label: $localize`:@@store.admin.account-security:كلمة المرور والتحقق`,
      icon: 'lock',
      url: '/admin/password',
    });
    return out;
  });

  protected readonly searching = computed(
    () => this.shell.projectQuery().length >= 2 && this.shell.projectMatches.isLoading(),
  );

  protected readonly items = computed<PaletteItem[]>(() => {
    const t = paletteTarget(this.query());
    const screens = this.screens();
    switch (t.kind) {
      case 'empty':
        return screens;
      case 'order':
        return [
          {
            id: 'go-order',
            label: $localize`:@@store.admin.palette-open-order:فتح التبرع ${t.reference}:ref:`,
            icon: 'inbox',
            url: `/admin/orders/${t.reference}`,
          },
        ];
      case 'reference':
        return [
          {
            id: 'go-reference',
            label: $localize`:@@store.admin.palette-search-reference:البحث في التبرعات عن ${t.reference}:ref:`,
            icon: 'search',
            url: '/admin/orders',
            queryParams: { reference: t.reference },
          },
        ];
      case 'mobile':
        return [
          {
            id: 'go-mobile',
            label: $localize`:@@store.admin.palette-search-mobile:تبرعات الجوال ${t.mobile}:mobile:`,
            icon: 'search',
            url: '/admin/orders',
            queryParams: { mobile: t.mobile },
          },
        ];
      case 'text': {
        const q = t.q.toLocaleLowerCase();
        const nav = screens.filter((s) => s.label.toLocaleLowerCase().includes(q));
        const projects = (valueOf(this.shell.projectMatches)?.items ?? []).map((p) => ({
          id: `project-${p.id}`,
          label: p.titleAr,
          hint: $localize`:@@store.admin.palette-project:مشروع`,
          icon: 'heart' as const,
          url: `/admin/projects/${p.id}`,
        }));
        return [...nav, ...projects];
      }
    }
  });

  protected readonly activeId = computed(() =>
    this.items().length ? `cp-o-${Math.min(this.active(), this.items().length - 1)}` : null,
  );

  protected type(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.query.set(v);
    this.active.set(0);
    clearTimeout(this.timer);
    const t = paletteTarget(v);
    this.timer = setTimeout(() => this.shell.projectQuery.set(t.kind === 'text' ? t.q : ''), 250);
  }

  protected key(e: KeyboardEvent): void {
    const n = this.items().length;
    if (!n) return;
    switch (e.key) {
      case 'ArrowDown':
        this.active.update((i) => (i + 1) % n);
        break;
      case 'ArrowUp':
        this.active.update((i) => (i - 1 + n) % n);
        break;
      case 'Home':
        this.active.set(0);
        break;
      case 'End':
        this.active.set(n - 1);
        break;
      case 'Enter': {
        const item = this.items()[Math.min(this.active(), n - 1)];
        if (item) this.go(item);
        break;
      }
      default:
        return;
    }
    e.preventDefault();
    document.getElementById(this.activeId() ?? '')?.scrollIntoView({ block: 'nearest' });
  }

  protected go(item: PaletteItem): void {
    this.open.set(false);
    void this.router.navigate([item.url], { queryParams: item.queryParams });
  }

  protected reset(): void {
    clearTimeout(this.timer);
    this.query.set('');
    this.active.set(0);
    this.shell.projectQuery.set('');
    const el = this.input()?.nativeElement;
    if (el) el.value = '';
  }
}
