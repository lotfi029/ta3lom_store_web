import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Store footer (prototype `#foot`, giving stripped — plan §2.6): about, store links, association links on ta3lom.sa
 * (identity, privacy, contact), contact e-mail and the accepted payment marks.
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
