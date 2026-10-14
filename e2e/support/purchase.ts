import { randomUUID } from 'node:crypto';
// Test tooling shared with the seed script (cookie jar + bearer client).
import { Client } from '../../scripts/lib/store-api-client.mjs';
import { otpFor, resetOtpLimits, staff } from './auth';

export interface Item {
  slug: string;
  format?: 'print' | 'digital';
  quantity?: number;
}

/** Signs a customer in through the API (OTP from /dev/sms) — for setting up account scenarios quickly. */
export async function customerClient(mobile: string): Promise<Client> {
  resetOtpLimits();
  const c = new Client();
  const started = Date.now() - 50;
  const req = await c.call('POST', '/v1/auth/otp/request', { mobile, locale: 'ar' });
  if (req.status !== 202) throw new Error(`otp request ${req.status}`);
  const v = await c.call('POST', '/v1/auth/otp/verify', {
    mobile,
    code: await otpFor(mobile, started),
  });
  if (v.status !== 200) throw new Error(`otp verify ${v.status} ${JSON.stringify(v.body)}`);
  c.token = v.body.accessToken;
  return c;
}

/**
 * The customer buys `items` through the real API (cart → quote → checkout with an Idempotency-Key) and, unless
 * `pay: false`, the dev trigger settles the order. Returns the order reference.
 */
export async function buy(
  c: Client,
  items: Item[],
  opts: { pay?: boolean; name?: string } = {},
): Promise<string> {
  let print = false;
  for (const it of items) {
    const p = await c.call('GET', `/v1/catalog/products/${it.slug}`);
    const format = it.format
      ? p.body.book.formats.find((f: { kind: string }) => f.kind === it.format)
      : null;
    if (it.format === 'print') print = true;
    const add = await c.call('POST', '/v1/cart/lines', {
      kind: 'buy',
      mode: 'units',
      amount: null,
      intent: null,
      dedication: null,
      productId: p.body.id,
      bookFormatId: format?.id ?? null,
      quantity: it.quantity ?? 1,
    });
    if (add.status !== 201)
      throw new Error(`add ${it.slug}: ${add.status} ${JSON.stringify(add.body)}`);
  }
  const quote = await c.call('POST', '/v1/checkout/quote', {});
  const order = await c.call(
    'POST',
    '/v1/checkout',
    {
      contact: { fullName: opts.name ?? 'نورة العتيبي', email: 'noura@example.com' },
      isAnonymous: false,
      shippingAddressId: null,
      shippingAddress: print
        ? {
            recipientName: 'نورة',
            recipientMobile: '0551234567',
            city: 'الرياض',
            district: null,
            shortAddress: 'RRRD2929',
            street: null,
            buildingNo: null,
            postalCode: null,
          }
        : null,
      saveAddress: print,
      paymentMethod: 'mada',
      acceptTerms: true,
      expectedGrandTotal: quote.body.grandTotal,
      locale: 'ar',
    },
    { 'Idempotency-Key': randomUUID() },
  );
  if (order.status !== 201)
    throw new Error(`checkout ${order.status} ${JSON.stringify(order.body)}`);
  const ref: string = order.body.reference;
  if (opts.pay !== false) {
    const paid = await c.call('POST', `/dev/orders/${ref}/confirm-payment`);
    if (paid.status !== 200) throw new Error(`confirm ${ref}: ${paid.status}`);
  }
  return ref;
}

/** Fulfilment ships the order's shipment (#75). */
export async function shipOrder(ref: string, trackingNo: string): Promise<void> {
  const f = await staff('fulfilment');
  for (let i = 0; i < 20; i++) {
    const list = await f.call('GET', '/v1/admin/shipments?status=preparing&pageSize=100');
    const s = list.body.items.find((x: { orderRef: string }) => x.orderRef === ref);
    if (s) {
      const res = await f.call('POST', `/v1/admin/shipments/${s.id}/ship`, {
        carrier: 'SMSA',
        trackingNo,
      });
      if (res.status !== 200)
        throw new Error(`ship ${ref}: ${res.status} ${JSON.stringify(res.body)}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no shipment for ${ref}`);
}
