import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './shared/ui/toast/toast';

/**
 * Session 2, Part 1: public chrome (header/footer/skip-link) moved to layout/public-layout,
 * nested under every public route in app.routes.ts — this root shell is now bare so /admin/**
 * never renders it. ta-toast is the one thing still rendered here, unconditionally, so a toast
 * raised from either the public site or the admin (error.interceptor.ts's 5xx path, or an admin
 * save/delete outcome) is visible regardless of which layout is active.
 */
@Component({
  imports: [RouterOutlet, Toast],
  selector: 'ta-root',
  templateUrl: './app.html',
})
export class App {}
