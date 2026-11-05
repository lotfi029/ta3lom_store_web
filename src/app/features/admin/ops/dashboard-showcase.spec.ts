import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { DashboardPage } from './dashboard.page';

/** SW-6: the dashboard says when the store runs in showcase mode (from GET /v1/catalog/config). */
describe('admin dashboard — showcase badge', () => {
  const API = 'https://store-api.test/v1';
  const tick = () => new Promise((r) => setTimeout(r));

  async function mount(paymentsEnabled: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
        {
          provide: StaffAuth,
          useValue: { roles: () => ['admin'], can: () => true, isSignedIn: () => false },
        },
      ],
    });
    const f = TestBed.createComponent(DashboardPage);
    f.detectChanges();
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API}/catalog/config`).flush({
      minGiftAmount: '10.00',
      maxLineAmount: '100000.00',
      cartMaxLines: 20,
      cartMaxTotal: '200000.00',
      maxQuantity: 99,
      amountPresets: [],
      paymentsEnabled,
      customerSignIn: paymentsEnabled,
    });
    await tick();
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('showcase: a "payments off" badge next to the title', async () => {
    const badge = (await mount(false)).querySelector('.mode-badge');
    expect(badge?.textContent).toContain('وضع العرض');
    expect(badge?.textContent).toContain('الدفع متوقف');
  });

  it('live: no badge', async () => {
    expect((await mount(true)).querySelector('.mode-badge')).toBeNull();
  });
});
