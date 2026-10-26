import { expect } from '@playwright/test';
import { Client } from '../../scripts/lib/store-api-client.mjs';
import { apiGet } from './api';
import { otpFor } from './auth';

/** A donation for this mobile, placed through the API (its own session): a category gift of 50. Returns the reference. */
export async function donate(mobile: string, locale: 'ar' | 'en'): Promise<string> {
  const c = new Client();
  const t0 = Date.now() - 50;
  await c.call('POST', '/v1/auth/otp/request', { mobile, locale });
  const s = await c.call('POST', '/v1/auth/otp/verify', { mobile, code: await otpFor(mobile, t0) });
  c.token = s.body.accessToken;
  const cats = await apiGet<{ id: string; acceptsGeneralGifts: boolean }[]>('/catalog/categories');
  const cat = cats.find((x) => x.acceptsGeneralGifts)!;
  const add = await c.call('POST', '/v1/cart/lines', { categoryId: cat.id, amount: '50' });
  expect(add.status).toBe(200);
  const order = await c.call(
    'POST',
    '/v1/checkout',
    { fullName: 'متبرع تجريبي', email: `acct-${Date.now()}@example.com`, locale },
    { 'Idempotency-Key': `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  );
  expect(order.status).toBe(201);
  return order.body.reference as string;
}
