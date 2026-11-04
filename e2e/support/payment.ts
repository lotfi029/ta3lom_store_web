import { expect, type Page } from '@playwright/test';

/**
 * The gateway's hosted page in e2e (R5-Payments): the real API's fake gateway (`/dev/payments/{id}`, Development) or
 * the stub's page — same button ids: `pay`, `fail`, `wrong` (wrong amount; real API only). After the action the donor
 * is sent back to the order page; when the API's `Store:WebBaseUrl` is another origin than the e2e server, the same
 * path and query are opened on the e2e server (the return URL proves nothing either way — the page asks the API).
 */
export async function payOnHostedPage(page: Page, action: 'pay' | 'fail' | 'wrong' = 'pay'): Promise<string> {
  await expect(page).toHaveURL(/\/dev\/payments\/[^/?#]+$/);
  await page.locator(`#${action}`).click();
  await page.waitForURL(/\/(ar|en)\/orders\/T3-\d{2}-\d{6}/);
  const back = new URL(page.url());
  const e2eOrigin = process.env.E2E_ORIGIN ?? `http://localhost:${process.env.E2E_PORT ?? 4320}`;
  if (back.origin !== e2eOrigin) await page.goto(`${e2eOrigin}${back.pathname}${back.search}`);
  return /orders\/(T3-\d{2}-\d{6})/.exec(back.pathname)![1];
}
