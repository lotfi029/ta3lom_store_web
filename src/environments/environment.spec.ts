import { environment as production } from './environment.production';
import { environment as development } from './environment';
import { environment as ci } from './environment.ci';
import { environment as local } from './environment.local';
import { environment as staging } from './environment.staging';

const all = { production, development, ci, local, staging };

describe('environments', () => {
  it('points production at the store API origin over https', () => {
    expect(production.production).toBe(true);
    expect(production.envName).toBe('production');
    expect(production.apiUrl).toBe('https://store-api.ta3lom.sa/v1');
    expect(production.siteOrigin).toBe('https://store.ta3lom.sa');
    expect(production.robots).toBe('index');
  });

  it('staging: its own API and site, https, never indexed', () => {
    expect(staging.envName).toBe('staging');
    expect(staging.apiUrl).toBe('https://store-api-staging.ta3lom.sa/v1');
    expect(staging.siteOrigin).toBe('https://store-staging.ta3lom.sa');
    expect(staging.robots).toBe('noindex');
  });

  it('D-W2: payments are off everywhere until R5-Payments (scripts/check-payments-flag.mjs blocks a production build)', () => {
    for (const env of Object.values(all)) expect(env.paymentsEnabled).toBe(false);
  });

  it('has no dev payment trigger any more (R5 has no /dev confirm-payment endpoint)', () => {
    for (const env of Object.values(all)) expect('devPaymentTrigger' in env).toBe(false);
  });

  it('M-3: the zakat and delivery-update trust items are off everywhere by default', () => {
    for (const env of Object.values(all))
      expect(env.trust).toEqual({ showZakat: false, showUpdates: false });
  });

  it('P5: the client error reporter is off (empty endpoint) everywhere until the owner sets one', () => {
    for (const env of Object.values(all)) expect(env.errorReportUrl).toBe('');
  });
});
