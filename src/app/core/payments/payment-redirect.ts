import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * ADR-S05 / plan §6 F5: the donor leaves for the gateway's hosted page ONLY when its URL is on the environment's
 * allow-list (`environment.paymentHosts`): exact host[:port] match, https (http only for localhost — the dev/CI fake).
 * Anything else is refused: the page shows "pay again" instead. Returning from the gateway proves nothing; the order
 * page asks the API.
 */
export function isAllowedPaymentUrl(
  url: string | null | undefined,
  hosts: readonly string[],
): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return false;
  return hosts.includes(u.host.toLowerCase());
}

@Injectable({ providedIn: 'root' })
export class PaymentRedirect {
  private readonly doc = inject(DOCUMENT);
  readonly hosts = environment.paymentHosts;

  /** Leaves for the hosted page; false (and no navigation) when the URL is not allow-listed. */
  go(url: string | null | undefined): boolean {
    if (!isAllowedPaymentUrl(url, this.hosts)) return false;
    this.doc.defaultView?.location.assign(url!);
    return true;
  }
}
