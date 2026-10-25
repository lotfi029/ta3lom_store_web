import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QuickDonate } from './core/ui/quick-donate.service';
import { QuickDonateModal } from './features/store/quick-donate/quick-donate';
import { Toast } from './shared/ui/toast/toast';

@Component({
  selector: 'ta-root',
  imports: [RouterOutlet, Toast, QuickDonateModal],
  template: `<router-outlet /><ta-toast />
    @defer (when qd.used()) {
      <ta-quick-donate />
    }`,
})
export class App {
  protected readonly qd = inject(QuickDonate);
}
