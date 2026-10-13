import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { SkipLink } from '../skip-link/skip-link';

/** Storefront and account chrome. The admin has its own shell (W-08), outside this layout. */
@Component({
  selector: 'ta-public-layout',
  imports: [RouterOutlet, SkipLink, Header, Footer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ta-skip-link />
    <ta-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <ta-footer />
  `,
  styles: `
    main {
      display: block;
      min-block-size: 60vh;
    }
    main:focus {
      outline: none;
    }
  `,
})
export class PublicLayout {}
