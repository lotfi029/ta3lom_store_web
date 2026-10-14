import type { WritableSignal } from '@angular/core';
import { form, required, validate } from '@angular/forms/signals';
import { type AddressModel, addressRules, emptyAddress } from '../../../core/address/address';
import { EMAIL } from '../../../core/forms/patterns';

export {
  SHORT_ADDRESS,
  normalizeShortAddress,
  toAddressInput,
} from '../../../core/address/address';

/** r4 payment methods (RUL-36); anything else the API lists is not rendered. */
export const PAYMENT_METHODS = ['mada', 'applepay', 'card', 'stcpay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface CheckoutModel {
  name: string;
  email: string;
  /** A saved address id, or `'new'` for the inline National Address form. */
  savedId: string;
  address: AddressModel;
  saveAddress: boolean;
  method: PaymentMethod;
  acceptTerms: boolean;
}

export const emptyCheckout = (): CheckoutModel => ({
  name: '',
  email: '',
  savedId: 'new',
  address: emptyAddress(),
  saveAddress: true,
  method: 'mada',
  acceptTerms: false,
});

/**
 * The checkout Signal Form (10 §7.2). The address rules apply only while the cart has a print line and the new-address
 * option is chosen (RUL-26); terms are required (FR-S30).
 */
export function checkoutForm(model: WritableSignal<CheckoutModel>, needsAddress: () => boolean) {
  const newAddress = () => needsAddress() && model().savedId === 'new';
  return form(model, (p) => {
    required(p.name, { message: $localize`:@@store.checkout.name-required:أدخل الاسم الكامل.` });
    validate(p.name, ({ value }) =>
      value().trim().length === 1
        ? { kind: 'name', message: $localize`:@@store.checkout.name-required:أدخل الاسم الكامل.` }
        : undefined,
    );
    required(p.email, {
      message: $localize`:@@store.checkout.email-required:أدخل البريد الإلكتروني لإرسال الفاتورة.`,
    });
    validate(p.email, ({ value }) =>
      value() && !EMAIL.test(value().trim())
        ? {
            kind: 'email',
            message: $localize`:@@store.checkout.email-invalid:بريد إلكتروني غير صحيح.`,
          }
        : undefined,
    );
    addressRules(p.address, newAddress);
    validate(p.acceptTerms, ({ value }) =>
      value()
        ? undefined
        : {
            kind: 'terms',
            message: $localize`:@@store.checkout.terms-required:يلزم قبول الشروط والأحكام وسياسة الاسترجاع.`,
          },
    );
  });
}
