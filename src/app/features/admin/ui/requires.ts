import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { type StaffPolicy } from '../../../core/auth/policies';
import { policyReason } from '../../../core/auth/policy-text';
import { StaffAuth } from '../../../core/auth/staff-auth';

/**
 * `<ta-requires policy="staff:admin" id="x-why" />` — the hint under a disabled admin action ("Requires the finance
 * role"). Renders nothing when the signed-in staff user holds the policy. The action points at it with
 * `aria-describedby`, so screen readers hear why the button is unavailable.
 */
@Component({
  selector: 'ta-requires',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (!allowed()) {
    <small class="why">{{ reason() }}</small>
  }`,
  styles: `
    .why {
      display: block;
      font-size: 0.78rem;
      color: var(--c-muted-2);
      margin-block-start: 4px;
    }
  `,
})
export class Requires {
  private readonly auth = inject(StaffAuth);
  readonly policy = input.required<StaffPolicy>();
  protected readonly allowed = computed(() => this.auth.can(this.policy()));
  protected readonly reason = computed(() => policyReason(this.policy()));
}
