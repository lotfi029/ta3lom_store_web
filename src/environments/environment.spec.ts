import { environment as production } from './environment.production';
import { environment as development } from './environment';

describe('environments', () => {
  it('never enables the dev payment trigger in production (plan §2.7)', () => {
    expect(production.devPaymentTrigger).toBe(false);
    expect(production.production).toBe(true);
  });

  it('points production at the store API origin over https', () => {
    expect(production.apiUrl).toBe('https://store-api.ta3lom.sa/v1');
    expect(production.siteOrigin).toBe('https://store.ta3lom.sa');
  });

  it('keeps the dev trigger available in development only', () => {
    expect(development.devPaymentTrigger).toBe(true);
    expect(development.production).toBe(false);
  });
});
