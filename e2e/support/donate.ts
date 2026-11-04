import { expect } from '@playwright/test';
import { Client } from '../../scripts/lib/store-api-client.mjs';
import { apiGet } from './api';
import { otpFor } from './auth';

export interface PlacedOrder {
  reference: string;
  statusToken: string;
  /** The gateway's hosted page (R5-Payments: the API's fake gateway in Development). */
  redirectUrl: string | null;
}

/** A donation for this mobile, placed through the API (its own session): a category gift (default 50). */
export async function placeOrder(mobile: string, locale: 'ar' | 'en', amount = '50'): Promise<PlacedOrder> {
  const c = new Client();
  const t0 = Date.now() - 50;
  await c.call('POST', '/v1/auth/otp/request', { mobile, locale });
  const s = await c.call('POST', '/v1/auth/otp/verify', { mobile, code: await otpFor(mobile, t0) });
  c.token = s.body.accessToken;
  const cats = await apiGet<{ id: string; acceptsGeneralGifts: boolean }[]>('/catalog/categories');
  const cat = cats.find((x) => x.acceptsGeneralGifts)!;
  const add = await c.call('POST', '/v1/cart/lines', { categoryId: cat.id, amount });
  expect(add.status).toBe(200);
  const order = await c.call(
    'POST',
    '/v1/checkout',
    { fullName: 'متبرع تجريبي', email: `acct-${Date.now()}@example.com`, locale },
    { 'Idempotency-Key': `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  );
  expect(order.status).toBe(201);
  return {
    reference: order.body.reference as string,
    statusToken: order.body.statusToken as string,
    redirectUrl: (order.body.payment?.redirectUrl as string | undefined) ?? null,
  };
}

/** A donation for this mobile, placed through the API (its own session): a category gift of 50. Returns the reference. */
export async function donate(mobile: string, locale: 'ar' | 'en'): Promise<string> {
  return (await placeOrder(mobile, locale)).reference;
}
