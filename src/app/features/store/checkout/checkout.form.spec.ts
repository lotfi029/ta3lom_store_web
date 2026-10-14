import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SHORT_ADDRESS,
  checkoutForm,
  emptyCheckout,
  normalizeShortAddress,
  toAddressInput,
} from './checkout.form';

describe('checkout form (plan §6)', () => {
  const make = (print: boolean) =>
    TestBed.runInInjectionContext(() => {
      const model = signal({
        ...emptyCheckout(),
        name: 'نورة العتيبي',
        email: 'noura@example.com',
        acceptTerms: true,
      });
      return { model, f: checkoutForm(model, () => print) };
    });

  it('National Address: RRRD2929 valid, lower case upper-cased, RRR2929 invalid', () => {
    expect(SHORT_ADDRESS.test('RRRD2929')).toBe(true);
    expect(normalizeShortAddress('rrrd 2929')).toBe('RRRD2929');
    expect(normalizeShortAddress('rrrd٢٩٢٩')).toBe('RRRD2929');
    expect(SHORT_ADDRESS.test(normalizeShortAddress('RRR2929'))).toBe(false);
  });

  it('normalises mobiles and digits in the address sent to the API', () => {
    const a = toAddressInput({
      recipientName: ' نورة ',
      recipientMobile: '٠٥٥ ١٢٣ ٤٥٦٧',
      city: 'الرياض',
      district: '',
      shortAddress: 'rrrd2929',
      street: '',
      buildingNo: '١٢',
      postalCode: '',
    });
    expect(a).toEqual({
      recipientName: 'نورة',
      recipientMobile: '0551234567',
      city: 'الرياض',
      district: null,
      shortAddress: 'RRRD2929',
      street: null,
      buildingNo: '12',
      postalCode: null,
    });
  });

  it('asks for the address only with a print line', () => {
    const digital = make(false);
    expect(digital.f().valid()).toBe(true);
    const print = make(true);
    expect(print.f().valid()).toBe(false);
    expect(
      print.f.address
        .shortAddress()
        .errors()
        .map((e) => e.kind),
    ).toContain('required');
    print.model.update((m) => ({
      ...m,
      address: {
        ...m.address,
        recipientName: 'نورة',
        recipientMobile: '0551234567',
        city: 'الرياض',
        shortAddress: 'RRR2929',
      },
    }));
    expect(
      print.f.address
        .shortAddress()
        .errors()
        .map((e) => e.kind),
    ).toEqual(['shortAddress']);
    print.model.update((m) => ({ ...m, address: { ...m.address, shortAddress: 'RRRD2929' } }));
    expect(print.f().valid()).toBe(true);
  });

  it('a saved address needs no inline fields', () => {
    const print = make(true);
    print.model.update((m) => ({ ...m, savedId: 'addr-1' }));
    expect(print.f().valid()).toBe(true);
  });

  it('terms are required', () => {
    const { model, f } = make(false);
    model.update((m) => ({ ...m, acceptTerms: false }));
    expect(
      f
        .acceptTerms()
        .errors()
        .map((e) => e.kind),
    ).toEqual(['terms']);
    expect(f().valid()).toBe(false);
  });

  it('rejects a bad email and a missing name', () => {
    const { model, f } = make(false);
    model.update((m) => ({ ...m, name: '', email: 'not-an-email' }));
    expect(f.name().invalid()).toBe(true);
    expect(
      f
        .email()
        .errors()
        .map((e) => e.kind),
    ).toEqual(['email']);
  });
});
