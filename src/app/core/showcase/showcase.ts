import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Showcase mode (deploy without payments, `environment.showcase`): donors see categories and projects, read only, with
 * «التبرع الإلكتروني قريبًا»; there is no cart, checkout, order, donor sign-in or account. Staff admin is unchanged.
 * A token (not the constant) so unit tests render both modes.
 */
export const SHOWCASE = new InjectionToken<boolean>('SHOWCASE', {
  providedIn: 'root',
  factory: () => environment.showcase,
});
