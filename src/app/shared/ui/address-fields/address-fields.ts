import { ChangeDetectionStrategy, Component, effect, input, untracked } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { type AddressModel, normalizeShortAddress } from '../../../core/address/address';

/**
 * The National Address fields (checkout's new address, the account address book). Presentational: the caller owns the
 * Signal Form and its rules (`core/address` `addressRules`). Field ids are `{idPrefix}-rname`, `-rmobile`, `-city`,
 * `-short`, `-district`, `-street`, `-building`, `-postal`; errors are tied to each field with aria-describedby. The
 * short address is shown as it will be stored (upper case, Western digits).
 */
@Component({
  selector: 'ta-address-fields',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './address-fields.html',
  styleUrl: './address-fields.css',
})
export class AddressFields {
  readonly field = input.required<FieldTree<AddressModel>>();
  readonly idPrefix = input.required<string>();

  constructor() {
    effect(() => {
      const state = this.field().shortAddress();
      const raw = state.value();
      const norm = normalizeShortAddress(raw);
      if (norm !== raw) untracked(() => state.value.set(norm));
    });
  }

  protected id(name: string): string {
    return `${this.idPrefix()}-${name}`;
  }
}
