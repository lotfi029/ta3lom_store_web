import { environment as production } from './environment.production';
import { environment as development } from './environment';
import { environment as ci } from './environment.ci';

describe('environments', () => {
  it('points production at the store API origin over https', () => {
    expect(production.production).toBe(true);
    expect(production.apiUrl).toBe('https://store-api.ta3lom.sa/v1');
    expect(production.siteOrigin).toBe('https://store.ta3lom.sa');
  });

  it('D-W2: payments are off everywhere until R5-Payments (scripts/check-payments-flag.mjs blocks a production build)', () => {
    for (const env of [production, development, ci]) expect(env.paymentsEnabled).toBe(false);
  });

  it('has no dev payment trigger any more (R5 has no /dev confirm-payment endpoint)', () => {
    for (const env of [production, development, ci]) expect('devPaymentTrigger' in env).toBe(false);
  });
});
