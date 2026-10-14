import { type SchemaPathTree, required, validate } from '@angular/forms/signals';
import type { Address, AddressInput } from '../api/api.types';
import { normalizeSaudiMobile, westernDigits } from '../i18n/western-digits';

/** Saudi National Address short code: four letters then four digits (DDL `customer_address.short_address`, 11 §5.2). */
export const SHORT_ADDRESS = /^[A-Z]{4}[0-9]{4}$/;
const POSTAL_CODE = /^[0-9]{5}$/;

/** The address as edited (checkout's new address, account address book). KSA only (RUL-26). */
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

/** A saved address → the edit model. */
export const fromAddress = (a: Address): AddressModel => ({
  recipientName: a.recipientName,
  recipientMobile: normalizeSaudiMobile(a.recipientMobile) ?? a.recipientMobile,
  city: a.city,
  district: a.district ?? '',
  shortAddress: a.shortAddress ?? '',
  street: a.street ?? '',
  buildingNo: a.buildingNo ?? '',
  postalCode: a.postalCode ?? '',
});

/** Short address as typed → the stored form: Western digits, no spaces, upper case (`rrrd 2929` → `RRRD2929`). */
export const normalizeShortAddress = (v: string): string =>
  westernDigits(v).replace(/\s+/g, '').toUpperCase();

const blank = (v: string): string | null => (v.trim() ? v.trim() : null);

/** The edit model → the API's `AddressInput` (mobiles as `05…`, digits Western, short address upper-cased). */
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

/** One line for lists and radio labels: name · city · district · short address. */
export const addressLine = (a: Address): string =>
  [a.recipientName, a.city, a.district, a.shortAddress].filter(Boolean).join(' · ');

/** The address rules (11 §5.2: mirror the DDL), active while `when()` is true. */
export function addressRules(
  a: SchemaPathTree<AddressModel>,
  when: () => boolean = () => true,
): void {
  required(a.recipientName, {
    when,
    message: $localize`:@@store.checkout.recipient-required:أدخل اسم المستلم.`,
  });
  required(a.recipientMobile, {
    when,
    message: $localize`:@@store.checkout.recipient-mobile-required:أدخل جوال المستلم.`,
  });
  validate(a.recipientMobile, ({ value }) =>
    when() && value() && !normalizeSaudiMobile(value())
      ? {
          kind: 'mobile',
          message: $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`,
        }
      : undefined,
  );
  required(a.city, { when, message: $localize`:@@store.checkout.city-required:أدخل المدينة.` });
  required(a.shortAddress, {
    when,
    message: $localize`:@@store.checkout.short-address-required:أدخل العنوان الوطني المختصر.`,
  });
  validate(a.shortAddress, ({ value }) =>
    when() && value() && !SHORT_ADDRESS.test(normalizeShortAddress(value()))
      ? {
          kind: 'shortAddress',
          message: $localize`:@@store.checkout.short-address-invalid:أربعة أحرف ثم أربعة أرقام، مثل RRRD2929.`,
        }
      : undefined,
  );
  validate(a.postalCode, ({ value }) =>
    when() && value() && !POSTAL_CODE.test(westernDigits(value()).trim())
      ? {
          kind: 'postalCode',
          message: $localize`:@@store.checkout.postal-code-invalid:الرمز البريدي من 5 أرقام.`,
        }
      : undefined,
  );
}
