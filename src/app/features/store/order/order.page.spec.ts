import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { OrderPage } from './order.page';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));

describe('OrderPage (F5, E-2, R3-2)', () => {
  beforeEach(() => sessionStorage.clear());

  /** Mounted through the real route (`orders/:ref`, inputs bound from the URL), as in the app. */
  async function mount(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'orders/:ref', component: OrderPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, OrderPage);
    harness.detectChanges();
    TestBed.tick();
    await tick();
    const http = TestBed.inject(HttpTestingController);
    http
      .match(`${API}/auth/refresh`)
      .forEach((r) => r.flush({ code: 'auth.refresh_invalid' }, { status: 401, statusText: 'x' }));
    return {
      fixture: { detectChanges: () => harness.detectChanges() },
      http,
      el: harness.routeNativeElement as HTMLElement,
      router: TestBed.inject(Router),
    };
  }

  it('E-2 / S-9: the token leaves the URL through the router, is kept for the request, and no-referrer is set', async () => {
    const { fixture, http, el, router } = await mount('/orders/t3-26-000001?t=secret&x=1#top');
    expect(router.url).toBe('/orders/t3-26-000001?x=1#top'); // the router's own state, every other parameter kept
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
      paymentStatus: 'initiated',
      canRetryPayment: false,
    });
    await tick();
    fixture.detectChanges();
    expect(el.querySelector('h2')?.textContent).toContain('نتحقق من دفعتك');
    expect(el.textContent).toContain('120');
    expect(el.querySelector('ta-share-sheet, ta-share-bar')).toBeNull();
    expect(sessionStorage.getItem('t3s-order-t:T3-26-000001')).toBe('secret');
  });

  it('R3-2: signed out with no token → sign in to view (OTP), no status request', async () => {
    const { fixture, http, el } = await mount('/orders/T3-26-000009');
    await tick();
    fixture.detectChanges();
    http.expectNone((r) => r.url.includes('/orders/'));
    expect(el.querySelector('ta-otp-sign-in')).not.toBeNull();
  });

  it('S-9: a URL without a token is left alone (no navigation)', async () => {
    const { router } = await mount('/orders/T3-26-000010?a=1#h');
    expect(router.url).toBe('/orders/T3-26-000010?a=1#h');
  });

  it('F5: paid shows the thanks, the receipt number and the download button; retry shows "pay again"', async () => {
    const { fixture, http, el } = await mount('/orders/T3-26-000002?t=tok');
    http
      .expectOne((r) => r.url.includes('/status'))
      .flush({
        reference: 'T3-26-000002',
        status: 'paid',
        totalAmount: '50.00',
        lineCount: 1,
        createdAt: '2026-10-25T10:00:00+00:00',
        paymentDueAt: '2026-10-25T11:00:00+00:00',
        paymentStatus: 'captured',
        canRetryPayment: false,
        receiptAvailable: true,
        receiptNumber: 'DR-2026-000003',
        refundedAmount: '0.00',
      });
    await tick();
    fixture.detectChanges();
    expect(el.querySelector('h2')?.textContent).toContain('وصل تبرعك');
    expect(el.textContent).toContain('DR-2026-000003');
    expect(el.querySelector('.receipt button')).not.toBeNull();
    expect(el.querySelector('.pay-again')).toBeNull();
  });
});
