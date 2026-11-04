import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QuickDonate } from './core/ui/quick-donate.service';
import { EnvRibbon } from './layout/env-ribbon/env-ribbon';
import { QuickDonateModal } from './features/store/quick-donate/quick-donate';
import { Toast } from './shared/ui/toast/toast';

@Component({
  selector: 'ta-root',
  imports: [RouterOutlet, Toast, QuickDonateModal, EnvRibbon],
  template: `<router-outlet /><ta-toast /><ta-env-ribbon />
    @defer (when qd.used()) {
      <ta-quick-donate />
    }`,
})
export class App {
  protected readonly qd = inject(QuickDonate);
}
