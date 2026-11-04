import { expect, type Page } from '@playwright/test';

/**
 * The gateway's hosted page in e2e (R5-Payments): the real API's fake gateway (`/dev/payments/{id}`, Development) or
 * the stub's page — same button ids: `pay`, `fail`, `wrong` (wrong amount; real API only). After the action the donor
 * is sent back to the order page; when the API's `Store:WebBaseUrl` is another origin than the e2e server, the return
 * goes to the same path and query on the e2e server (the return URL proves nothing either way —
 * the page asks the API).
 */
export async function payOnHostedPage(page: Page, action: 'pay' | 'fail' | 'wrong' = 'pay'): Promise<string> {
  const e2eOrigin = process.env.E2E_ORIGIN ?? `http://localhost:${process.env.E2E_PORT ?? 4320}`;
  // Playwright does not route a request reached through a redirect, so the action's own POST is answered here with the
  // gateway's 302, its Location moved onto the e2e origin.
  const isAction = (u: URL) => /\/dev\/payments\/[^/]+\/(pay|fail|wrong-amount)$/.test(u.pathname);
  await page.route(isAction, async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    const loc = res.headers()['location'];
    if (!loc) return route.fulfill({ response: res });
    const u = new URL(loc, route.request().url());
    return route.fulfill({ status: 302, headers: { location: `${e2eOrigin}${u.pathname}${u.search}` } });
  });
  try {
    await expect(page).toHaveURL(/\/dev\/payments\/[^/?#]+$/);
    await page.locator(`#${action}`).click();
    await page.waitForURL((u) => u.origin === e2eOrigin && /^\/(ar|en)\/orders\/T3-\d{2}-\d{6}/.test(u.pathname));
  } finally {
    await page.unroute(isAction);
  }
  return /orders\/(T3-\d{2}-\d{6})/.exec(new URL(page.url()).pathname)![1];
}
