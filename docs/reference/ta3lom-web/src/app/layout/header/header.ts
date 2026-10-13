import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n';
import { Button } from '../../shared/ui/button/button';
import { LangSwitch } from '../lang-switch/lang-switch';
import { Nav } from '../nav/nav';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import { NavGroup, buildNavGroups } from '../nav-data';

@Component({
  selector: 'ta-header',
  imports: [RouterLink, Nav, LangSwitch, ThemeToggle, Button],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private readonly i18n = inject(I18nService);

  protected readonly scrolled = signal(false);
  protected readonly mobileOpen = signal(false);
  private readonly burger = viewChild<ElementRef<HTMLButtonElement>>('burger');

  protected readonly groups: NavGroup[] = buildNavGroups(this.i18n);
  protected readonly siteName = this.i18n.pick('تعلم', 'ta3lom');
  protected readonly siteSubtitle = this.i18n.pick('جمعية التعلم الإلكتروني', 'E-Learning Association');
  protected readonly donateLabel = this.i18n.pick('المتجر', 'Store');
  protected readonly menuLabel = this.i18n.pick('القائمة', 'Menu');
  protected readonly logoAlt = this.i18n.pick('شعار جمعية التعلم الإلكتروني', 'E-Learning Association logo');

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  /**
   * Escape closes the mobile drawer and puts focus back on the burger that opened it. The drawer is
   * not a ta-dialog — it pushes content rather than covering it — so it gets none of the native
   * <dialog> behaviour for free, and until now a keyboard user could only close it by tabbing all
   * the way back to the burger.
   */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    this.burger()?.nativeElement.focus();
  }

  protected toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
