import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { OrderPage, withoutToken } from './order.page';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));

describe('OrderPage (D-W2, E-2, R3-2)', () => {
  beforeEach(() => sessionStorage.clear());

  function mount(ref: string, t?: string) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    const fixture = TestBed.createComponent(OrderPage);
    fixture.componentRef.setInput('ref', ref);
    if (t) fixture.componentRef.setInput('t', t);
    fixture.detectChanges();
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    http
      .match(`${API}/auth/refresh`)
      .forEach((r) => r.flush({ code: 'auth.refresh_invalid' }, { status: 401, statusText: 'x' }));
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  }

  it('E-2: the token is removed from the URL after load, kept for the request, and no-referrer is set', async () => {
    history.replaceState(null, '', '/ar/orders/T3-26-000001?t=secret&x=1#top');
    const { fixture, http, el } = mount('t3-26-000001', 'secret');
    expect(location.search).toBe('?x=1');
    expect(location.hash).toBe('#top');
    expect(document.querySelector('meta[name=referrer]')?.getAttribute('content')).toBe(
      'no-referrer',
    );
    const req = http.expectOne((r) => r.url === `${API}/orders/T3-26-000001/status`);
    expect(req.request.params.get('t')).toBe('secret');
    req.flush({
      reference: 'T3-26-000001',
      status: 'pending_payment',
      totalAmount: '120.00',
      lineCount: 2,
      createdAt: '2026-10-25T10:00:00+00:00',
      paymentDueAt: '2026-10-25T11:00:00+00:00',
    });
    await tick();
    fixture.detectChanges();
    expect(el.querySelector('h2')?.textContent).toContain('تم تسجيل تبرعك');
    expect(el.textContent).toContain('120');
    expect(el.querySelector('ta-share-sheet, ta-share-bar')).toBeNull();
    expect(sessionStorage.getItem('t3s-order-t:T3-26-000001')).toBe('secret');
  });

  it('R3-2: signed out with no token → sign in to view (OTP), no status request', async () => {
    history.replaceState(null, '', '/ar/orders/T3-26-000009');
    const { fixture, http, el } = mount('T3-26-000009');
    await tick();
    fixture.detectChanges();
    http.expectNone((r) => r.url.includes('/orders/'));
    expect(el.querySelector('ta-otp-sign-in')).not.toBeNull();
  });

  it('keeps every other parameter and the hash', () => {
    expect(withoutToken('https://x.test/ar/orders/R?t=1')).toBe('/ar/orders/R');
    expect(withoutToken('https://x.test/ar/orders/R?a=1&t=2#h')).toBe('/ar/orders/R?a=1#h');
  });
});
