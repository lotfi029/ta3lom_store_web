import type { WritableSignal } from '@angular/core';
import { form, required, validate } from '@angular/forms/signals';
import type { AddressInput } from '../../../core/api/api.types';
import { normalizeSaudiMobile, westernDigits } from '../../../core/i18n/western-digits';

/** Saudi National Address short code: four letters then four digits (DDL `customer_address.short_address`). */
export const SHORT_ADDRESS = /^[A-Z]{4}[0-9]{4}$/;
const POSTAL_CODE = /^[0-9]{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** r4 payment methods (RUL-36); anything else the API lists is not rendered. */
export const PAYMENT_METHODS = ['mada', 'applepay', 'card', 'stcpay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface AddressModel {
  recipientName: string;
  recipientMobile: string;
  city: string;
  district: string;
  shortAddress: string;
  street: string;
  buildingNo: string;
  postalCode: string;
}

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

export const emptyAddress = (): AddressModel => ({
  recipientName: '',
  recipientMobile: '',
  city: '',
  district: '',
  shortAddress: '',
  street: '',
  buildingNo: '',
  postalCode: '',
});

export const emptyCheckout = (): CheckoutModel => ({
  name: '',
  email: '',
  savedId: 'new',
  address: emptyAddress(),
  saveAddress: true,
  method: 'mada',
  acceptTerms: false,
});

/** Short address as typed → the stored form: Western digits, no spaces, upper case (`rrrd 2929` → `RRRD2929`). */
export const normalizeShortAddress = (v: string): string =>
  westernDigits(v).replace(/\s+/g, '').toUpperCase();

const blank = (v: string): string | null => (v.trim() ? v.trim() : null);

/** The inline address → the API's `AddressInput` (mobiles as `05…`, digits Western). */
export function toAddressInput(a: AddressModel): AddressInput {
  return {
    recipientName: a.recipientName.trim(),
    recipientMobile: normalizeSaudiMobile(a.recipientMobile) ?? a.recipientMobile.trim(),
    city: a.city.trim(),
    district: blank(a.district),
    shortAddress: blank(normalizeShortAddress(a.shortAddress)),
    street: blank(a.street),
    buildingNo: blank(westernDigits(a.buildingNo)),
    postalCode: blank(westernDigits(a.postalCode)),
  };
}

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
    required(p.address.recipientName, {
      when: newAddress,
      message: $localize`:@@store.checkout.recipient-required:أدخل اسم المستلم.`,
    });
    required(p.address.recipientMobile, {
      when: newAddress,
      message: $localize`:@@store.checkout.recipient-mobile-required:أدخل جوال المستلم.`,
    });
    validate(p.address.recipientMobile, ({ value }) =>
      newAddress() && value() && !normalizeSaudiMobile(value())
        ? {
            kind: 'mobile',
            message: $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`,
          }
        : undefined,
    );
    required(p.address.city, {
      when: newAddress,
      message: $localize`:@@store.checkout.city-required:أدخل المدينة.`,
    });
    required(p.address.shortAddress, {
      when: newAddress,
      message: $localize`:@@store.checkout.short-address-required:أدخل العنوان الوطني المختصر.`,
    });
    validate(p.address.shortAddress, ({ value }) =>
      newAddress() && value() && !SHORT_ADDRESS.test(normalizeShortAddress(value()))
        ? {
            kind: 'shortAddress',
            message: $localize`:@@store.checkout.short-address-invalid:أربعة أحرف ثم أربعة أرقام، مثل RRRD2929.`,
          }
        : undefined,
    );
    validate(p.address.postalCode, ({ value }) =>
      newAddress() && value() && !POSTAL_CODE.test(westernDigits(value()).trim())
        ? {
            kind: 'postalCode',
            message: $localize`:@@store.checkout.postal-code-invalid:الرمز البريدي من 5 أرقام.`,
          }
        : undefined,
    );
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
