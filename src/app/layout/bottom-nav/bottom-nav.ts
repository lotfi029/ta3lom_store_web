import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StoreAuth } from '../../core/auth/store-auth';
import { CartSummary } from '../../core/cart/cart-summary';
import { SHOWCASE } from '../../core/showcase/showcase';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Option C phone bottom bar (docs/redesign/option-c-plan.md, Phase 2): a floating glass pill under 600 px with home,
 * cart (count badge; the header's accessible cart name), account or sign-in, and the menu button that opens the
 * header's drawer. No cart or account entry in showcase mode. It steps aside while the project page's donate bar
 * shows, and base.css reserves room for it under the page (--bottom-bar-h).
 */
@Component({
  selector: 'ta-bottom-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  protected readonly auth = inject(StoreAuth);
  protected readonly cart = inject(CartSummary);
  protected readonly showcase = inject(SHOWCASE);
  /** Whether the header's drawer is open (the menu button's aria-expanded). */
  readonly menuOpen = input(false);
  /** The header's accessible name for the cart ("سلة التبرعات، 2 تبرع، الإجمالي …"). */
  readonly cartLabel = input('');
  /** The menu button was pressed. */
  readonly menu = output<void>();
}
