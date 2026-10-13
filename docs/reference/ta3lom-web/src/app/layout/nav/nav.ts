import { Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '../../core/i18n';
import { NavGroup, buildNavGroups } from '../nav-data';

/**
 * Grace period before a menu closes on pointer-out. Without it, the diagonal path from a trigger
 * down to the far side of its own menu leaves the group for a few frames and the menu vanishes
 * mid-reach. 120ms covers that movement while a deliberate move away still feels immediate.
 */
const CLOSE_DELAY_MS = 120;

/**
 * The "About"/"Media"/"Get involved" dropdowns use a hand-built disclosure pattern
 * (button + aria-expanded/aria-controls + Escape + click-outside), not @angular/aria's
 * menu primitive — the WAI-ARIA Authoring Practices reserve `role="menu"` for command
 * menus (an app's File/Edit menu), not site navigation; using it here would be the
 * documented anti-pattern, not the accessible choice.
 *
 * WHY THERE IS EXACTLY ONE SIGNAL
 * This previously tracked four (`openId`, `hoverId`, `focusId`, `dismissedId`) because opening was
 * split across two mechanisms that could not see each other: CSS `:hover`/`:focus-within` revealed
 * a menu on its own, while a click toggled a `.open` class, and the extra signals existed to
 * reconcile what `aria-expanded` should then claim. Two mechanisms meant TWO MENUS COULD BE OPEN AT
 * ONCE — click one group, move the pointer over another, and both panels rendered, overlapping and
 * clipping each other's labels. `dismissedId` was a further patch for a problem the split created:
 * after Escape, focus is still inside the group, so `:focus-within` held the menu open and only a
 * class overriding the CSS could shut it.
 *
 * One signal removes all of that by construction. Hover, focus and click write the same value, so
 * opening a second group necessarily closes the first; `aria-expanded` is simply whether this group
 * is that value, so what is announced can no longer disagree with what is drawn; and Escape is a
 * plain `set(null)` with nothing left to override.
 */
@Component({
  selector: 'ta-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav implements OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly groups: NavGroup[] = buildNavGroups(this.i18n);

  /** The one open group, whatever opened it. Never more than one. */
  private readonly activeId = signal<string | null>(null);

  private closeTimer?: ReturnType<typeof setTimeout>;

  /** Drives both the `.open` class and `aria-expanded`, so what is announced is what is drawn. */
  protected expanded(id: string): boolean {
    return this.activeId() === id;
  }

  /**
   * Idempotent open, not a flip. A real pointer click always fires `mouseenter` (which already
   * opens the group) before the `click` event itself — so a toggle here would close what the
   * hover just opened, and every mouse click on a trigger would flicker the panel open then
   * immediately shut. Closing stays exclusively the job of hover-out, Escape, outside-click and
   * focus-out; a click can only open or no-op.
   */
  protected open(id: string): void {
    clearTimeout(this.closeTimer);
    this.activeId.set(id);
  }

  private scheduleClose(): void {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.activeId.set(null), CLOSE_DELAY_MS);
  }

  protected closeNow(): void {
    clearTimeout(this.closeTimer);
    this.activeId.set(null);
  }

  protected onEnter(id: string): void {
    this.open(id);
  }

  /** Scheduled, not immediate — see CLOSE_DELAY_MS. Entering another group cancels this timer, so
   *  moving along the nav swaps menus rather than flickering through a closed state. */
  protected onLeave(): void {
    this.scheduleClose();
  }

  protected onFocusIn(id: string): void {
    this.open(id);
  }

  /** Closes once focus leaves the group entirely (e.g. Tab past the last link). */
  protected onFocusOut(event: FocusEvent, container: HTMLElement): void {
    const next = event.relatedTarget as Node | null;
    if (next && container.contains(next)) return;
    this.closeNow();
  }

  /**
   * Escape: return focus to the trigger, then close.
   *
   * The order is load-bearing. `focus()` dispatches `focusin` SYNCHRONOUSLY, and that event bubbles
   * to `.dd` — so closing first and focusing second would run `onFocusIn` afterwards and reopen the
   * menu Escape had just shut, whenever focus was on one of the links rather than the trigger
   * itself. Focusing first lets that reopen happen and then overwrites it, which needs no
   * suppression flag and leaves no window where the state is wrong.
   */
  protected closeAndFocus(trigger: HTMLButtonElement): void {
    trigger.focus();
    this.closeNow();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.activeId() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeNow();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.closeTimer);
  }
}
