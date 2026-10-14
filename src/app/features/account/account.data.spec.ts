import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../core/api/store-api-url';
import { StoreAuth } from '../../core/auth/store-auth';
import { AccountData } from './account.data';
import { documentKind, orderStatus, shipmentStatus } from './labels';

const API = 'https://store-api.test/v1';

describe('AccountData (#21–#39)', () => {
  let data: AccountData;
  let http: HttpTestingController;
  let auth: StoreAuth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    data = TestBed.inject(AccountData);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(StoreAuth);
  });

  it('reads nothing without a session', () => {
    TestBed.tick();
    http.expectNone(`${API}/me`);
    http.expectNone(`${API}/me/enrolments`);
  });

  it('deletes the account with { confirm: true } and drops the local session (RUL-61)', async () => {
    const clear = vi.spyOn(auth, 'clear');
    const done = data.deleteAccount();
    const req = http.expectOne(`${API}/me`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ confirm: true });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await done;
    expect(clear).toHaveBeenCalled();
  });

  it('asks for a signed download link (#32) and fetches invoices as PDF blobs (#37)', async () => {
    const link = data.downloadLink('g1');
    const r = http.expectOne(`${API}/me/downloads/g1/link`);
    expect(r.request.method).toBe('POST');
    r.flush({ url: `${API}/downloads/tok`, expiresAt: '2026-10-14T10:10:00Z', remaining: 4 });
    expect((await link).remaining).toBe(4);
    const pdf = data.document('INV-2026-000001');
    const d = http.expectOne(`${API}/me/documents/INV-2026-000001`);
    expect(d.request.responseType).toBe('blob');
    d.flush(new Blob(['%PDF']));
    expect(await pdf).toBeInstanceOf(Blob);
  });

  it('saves a new address with POST and an existing one with PUT', async () => {
    const body = {
      recipientName: 'N',
      recipientMobile: '0551234567',
      city: 'Riyadh',
      district: null,
      shortAddress: 'RRRD2929',
      street: null,
      buildingNo: null,
      postalCode: null,
    };
    const a = data.saveAddress(null, body);
    http
      .expectOne((r) => r.method === 'POST' && r.url === `${API}/me/addresses`)
      .flush({ ...body, id: 'a1', isDefault: true });
    await a;
    const b = data.saveAddress('a1', body);
    http
      .expectOne((r) => r.method === 'PUT' && r.url === `${API}/me/addresses/a1`)
      .flush({ ...body, id: 'a1', isDefault: true });
    await b;
  });

  it('labels order, shipment and document states', () => {
    expect(orderStatus('paid').tone).toBe('success');
    expect(orderStatus('pending_payment').tone).toBe('warning');
    expect(shipmentStatus('shipped').tone).toBe('info');
    expect(documentKind('credit_note')).not.toBe(documentKind('invoice'));
  });
});
