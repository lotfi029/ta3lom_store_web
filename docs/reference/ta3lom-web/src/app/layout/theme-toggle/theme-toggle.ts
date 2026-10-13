import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { ThemeService } from '../../core/theme.service';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * The dark-mode switch (CR-01 FE-1) — in the public header next to the language switch, and in the
 * admin sidebar head. A toggle BUTTON (`aria-pressed`), not a checkbox or a three-way menu: its
 * accessible name stays «الوضع الداكن» / "Dark mode" and the pressed state says whether it is on.
 * Until a visitor presses it, the site follows their OS setting (ThemeService's `system`).
 *
 * Icon-only on screen, so the name is visually-hidden text (not an aria-label) — it is then also
 * translated by the page's own language and read by every screen reader the same way. The glyph
 * shows the mode a press would switch TO.
 */
@Component({
  selector: 'ta-theme-toggle',
  imports: [Icon],
  template: `
    <button type="button" class="theme-toggle" [class.on-dark]="onDark()" [attr.aria-pressed]="dark()" [attr.title]="label" (click)="theme.toggle()">
      <ta-icon [name]="dark() ? 'sun' : 'moon'" [size]="20" />
      <span class="visually-hidden">{{ label }}</span>
    </button>
  `,
  styleUrl: './theme-toggle.css',
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18nService);

  /** The admin sidebar is a permanently dark surface in both themes. */
  readonly onDark = input(false);

  protected readonly dark = computed(() => this.theme.effective() === 'dark');
  protected readonly label = this.i18n.pick('الوضع الداكن', 'Dark mode');
}
