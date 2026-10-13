import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/ui/icon/icon';

/** Dark-mode toggle button (`aria-pressed`); the glyph shows the mode a press switches to. */
@Component({
  selector: 'ta-theme-toggle',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [class.on-dark]="onDark()"
      [attr.aria-pressed]="dark()"
      [attr.title]="label"
      (click)="theme.toggle()"
    >
      <ta-icon [name]="dark() ? 'sun' : 'moon'" [size]="20" />
      <span class="visually-hidden">{{ label }}</span>
    </button>
  `,
  styleUrl: './theme-toggle.css',
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  readonly onDark = input(false);
  protected readonly dark = computed(() => this.theme.effective() === 'dark');
  protected readonly label = $localize`:@@store.layout.dark-mode:الوضع الداكن`;
}
