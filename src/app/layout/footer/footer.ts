import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Store footer (prototype `#foot`): about, store links, association links on ta3lom.sa (identity, privacy, contact) and
 * the contact e-mail. No payment marks while online payment is off (D-W2).
 */
@Component({
  selector: 'ta-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  protected readonly main = environment.mainSiteUrl;
  protected readonly year = new Date().getFullYear();
}
