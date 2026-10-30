import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../core/api/store-api-url';
import { StoreAuth } from '../../core/auth/store-auth';
import { CartStore } from '../../core/cart/cart-store';
import { AccountData, donationUrl } from './account.data';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));

describe('AccountData (contract 15 §2.5)', () => {
  let data: AccountData;
  let http: HttpTestingController;
  const calls: string[] = [];
  const auth = {
    isSignedIn: () => true,
    setProfile: vi.fn(),
    clear: vi.fn(() => calls.push('clear')),
    logoutAll: vi.fn(async () => void calls.push('logout-all')),
  };
  const cart = { reset: vi.fn(() => calls.push('cart-reset')) };

  beforeEach(() => {
    calls.length = 0;
    TestBed.configureTestingModule({
      providers: [
        AccountData,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
        { provide: StoreAuth, useValue: auth },
        { provide: CartStore, useValue: cart },
      ],
    });
    data = TestBed.inject(AccountData);
    http = TestBed.inject(HttpTestingController);
  });

  it('links a reference in its canonical upper case', () => {
    expect(donationUrl(API, ' t3-26-000001 ')).toBe(`${API}/me/donations/T3-26-000001`);
  });

  it('sign out everywhere calls logout-all (StoreAuth refreshes on 401), then empties the local cart', async () => {
    await data.logoutAll();
    expect(calls).toEqual(['logout-all', 'cart-reset']);
  });

  it('a failed sign out everywhere still empties the local cart and rejects', async () => {
    auth.logoutAll.mockRejectedValueOnce(new Error('x'));
    await expect(data.logoutAll()).rejects.toBeTruthy();
    expect(calls).toEqual(['cart-reset']);
  });

  it('delete: DELETE /v1/me, then signed out and the cart cleared locally', async () => {
    const p = data.deleteAccount();
    await tick();
    const req = http.expectOne((r) => r.method === 'DELETE' && r.url === `${API}/me`);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await p;
    expect(calls).toEqual(['clear', 'cart-reset']);
  });

  it('a failed delete keeps the session', async () => {
    const p = data.deleteAccount();
    await tick();
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush({ code: 'auth.account_blocked' }, { status: 403, statusText: 'x' });
    await expect(p).rejects.toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('export downloads the JSON as a Blob; PATCH /me updates the menu profile', async () => {
    const e = data.exportData();
    await tick();
    http
      .match((r) => r.url === `${API}/me` || r.url === `${API}/me/donations`)
      .forEach((r) => r.flush({}));
    http
      .expectOne(`${API}/me/export`)
      .flush({ profile: { id: 'x' }, donations: [], exportedAt: 'now' });
    const blob = await e;
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text()).profile.id).toBe('x');
    const u = data.updateMe({ fullName: 'Noura', email: null, locale: null, marketingOptIn: null });
    await tick();
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush({ id: 'x', fullName: 'Noura', mobile: '+966551234567', email: null, locale: 'ar' });
    await u;
    expect(auth.setProfile).toHaveBeenCalled();
  });
});
