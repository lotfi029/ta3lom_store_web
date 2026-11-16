import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The six admin badge colours (docs/admin-redesign/02 §5); each is a text-on-tint token pair in tokens.css. */
export type BadgeKind = 'ok' | 'sched' | 'warn' | 'err' | 'draft' | 'new';

/** Wire values the admin shows as badges, grouped by where they come from (status-labels.ts has their labels). */
export const PROJECT_STATUSES = ['draft', 'published', 'archived'] as const;
export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'payment_review',
  'expired',
  'cancelled',
  'refunded',
] as const;
export const CUSTOMER_STATUSES = ['active', 'blocked', 'anonymised'] as const;
export const PROJECT_BADGES = ['new', 'urgent'] as const;

const KINDS: Readonly<Record<string, BadgeKind>> = {
  // Projects
  published: 'ok',
  draft: 'draft',
  archived: 'err',
  // Donations (orders)
  pending_payment: 'sched',
  paid: 'ok',
  payment_review: 'warn',
  expired: 'draft',
  cancelled: 'err',
  refunded: 'draft',
  // Donors
  active: 'ok',
  blocked: 'err',
  anonymised: 'draft',
  // Project badges
  new: 'new',
  urgent: 'warn',
};

/** Badge colour for a project, donation or donor status (or a project badge); unknown values are neutral. */
export function badgeKind(status: string | null | undefined): BadgeKind {
  return (status && KINDS[status]) || 'draft';
}

/** `<ta-admin-badge kind="ok">منشور</ta-admin-badge>` — a status badge with a leading dot; the label is projected. */
@Component({
  selector: 'ta-admin-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span class="b" [class]="kind()"><ng-content /></span>',
  styles: `
    .b {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.6;
      padding-block: 1px;
      padding-inline: 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .b::before {
      content: '';
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: currentcolor;
    }
    .ok {
      background: var(--c-badge-ok-bg);
      color: var(--c-badge-ok-text);
    }
    .sched {
      background: var(--c-badge-sched-bg);
      color: var(--c-badge-sched-text);
    }
    .warn {
      background: var(--c-badge-warn-bg);
      color: var(--c-badge-warn-text);
    }
    .err {
      background: var(--c-badge-err-bg);
      color: var(--c-badge-err-text);
    }
    .draft {
      background: var(--c-badge-draft-bg);
      color: var(--c-badge-draft-text);
    }
    .new {
      background: var(--c-badge-new-bg);
      color: var(--c-badge-new-text);
    }
    .new::before {
      display: none;
    }
  `,
})
export class AdminBadge {
  readonly kind = input<BadgeKind>('draft');
}
