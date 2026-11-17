import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';

export type EditLang = 'ar' | 'en';

/**
 * عربي / English switch over the bilingual fields (mockup D-Project). ARIA tabs: ← → Home End move and select; each
 * tab controls `<prefix>-panel-<lang>`, which the page renders with `role="tabpanel"` and `hidden` when inactive.
 */
@Component({
  selector: 'ta-lang-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lt" role="tablist" [attr.aria-label]="label()">
      @for (l of langs; track l.key) {
        <button
          type="button"
          role="tab"
          [id]="idPrefix() + '-tab-' + l.key"
          [attr.aria-controls]="idPrefix() + '-panel-' + l.key"
          [attr.aria-selected]="lang() === l.key"
          [attr.tabindex]="lang() === l.key ? 0 : -1"
          [attr.lang]="l.key"
          (click)="lang.set(l.key)"
          (keydown)="key($event)"
        >
          {{ l.name }}
        </button>
      }
    </div>
  `,
  styles: `
    .lt {
      display: inline-flex;
      padding: 3px;
      border-radius: 10px;
      background: var(--c-surface-2);
    }
    button {
      min-block-size: 40px;
      min-inline-size: 72px;
      padding-inline: 12px;
      border: 0;
      border-radius: 8px;
      background: none;
      color: var(--c-muted-2);
      font: inherit;
      font-size: 0.88rem;
      cursor: pointer;
    }
    button[aria-selected='true'] {
      background: var(--c-surface);
      color: var(--c-text);
      font-weight: 600;
      box-shadow: 0 1px 3px var(--c-header-shadow);
    }
  `,
})
export class LangTabs {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly lang = model<EditLang>('ar');
  readonly idPrefix = input.required<string>();
  readonly label = input.required<string>();
  protected readonly langs: readonly { key: EditLang; name: string }[] = [
    { key: 'ar', name: 'العربية' },
    { key: 'en', name: 'English' },
  ];

  protected key(e: KeyboardEvent): void {
    const order: EditLang[] = ['ar', 'en'];
    const i = order.indexOf(this.lang());
    let next: EditLang | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') next = order[(i + 1) % 2]!;
    else if (e.key === 'Home') next = 'ar';
    else if (e.key === 'End') next = 'en';
    if (!next) return;
    e.preventDefault();
    this.lang.set(next);
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.idPrefix()}-tab-${next}`)?.focus();
  }
}
