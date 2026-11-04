import { isAllowedPaymentUrl } from './payment-redirect';

describe('payment redirect allow-list (ADR-S05, A-6)', () => {
  const prod = ['checkout.moyasar.com'];
  const dev = ['localhost:5080'];

  it('allows the Moyasar hosted invoice page over https', () => {
    expect(isAllowedPaymentUrl('https://checkout.moyasar.com/invoices/abc?lang=ar', prod)).toBe(
      true,
    );
  });

  it.each([
    ['http://checkout.moyasar.com/invoices/abc', 'not https'],
    ['https://checkout.moyasar.com.evil.example/invoices/abc', 'suffix host'],
    ['https://evil.example/?u=https://checkout.moyasar.com', 'another host'],
    ['https://user:pw@checkout.moyasar.com/x', 'credentials in the URL'],
    ['javascript:alert(1)', 'script URL'],
    ['/dev/payments/x', 'relative URL'],
    ['', 'empty'],
  ])('refuses %s (%s)', (url) => {
    expect(isAllowedPaymentUrl(url, prod)).toBe(false);
  });

  it('allows the local fake page (http on localhost) only with its port', () => {
    expect(isAllowedPaymentUrl('http://localhost:5080/dev/payments/fake_inv_1', dev)).toBe(true);
    expect(isAllowedPaymentUrl('http://localhost:9999/dev/payments/fake_inv_1', dev)).toBe(false);
    expect(isAllowedPaymentUrl('http://localhost:5080/dev/payments/fake_inv_1', prod)).toBe(false);
  });
});
