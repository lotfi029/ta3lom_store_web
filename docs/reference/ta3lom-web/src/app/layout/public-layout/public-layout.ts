import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { SkipLink } from '../skip-link/skip-link';

/**
 * Session 2, Part 1: the public chrome (skip link, header, footer) used to live directly in
 * app.html, rendered unconditionally around every route including /admin. The admin has its own
 * shell (features/admin/admin-shell) with no public header/footer — see
 * docs/architecture/05-admin-shell.md ("Footer hidden inside admin"). Every pre-existing public
 * route is now nested under this component in app.routes.ts; app.html is just a bare
 * <router-outlet /> so /admin/** never renders this at all.
 */
@Component({
  selector: 'ta-public-layout',
  imports: [RouterOutlet, SkipLink, Header, Footer],
  templateUrl: './public-layout.html',
})
export class PublicLayout {}
