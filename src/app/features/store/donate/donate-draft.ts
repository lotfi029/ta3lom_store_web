import type { ProjectOption } from '../../../core/api/api.types';
import type { CartDraft } from '../../../core/cart/cart-store';
import { OPEN_AMOUNT } from '../../../shared/ui/option-picker/option-picker';

/** What the donate box needs about a project (from a `ProjectCard` + its options, or a `ProjectDetail`). */
export interface DonateProject {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  allowOpenAmount: boolean;
  /** The effective open-amount minimum (project `minAmount` ?? config `minGiftAmount`). */
  minAmount: string;
  /** Active options by sort; null while still loading. */
  options: readonly ProjectOption[] | null;
}

/** The choice the box starts with: the open amount when the project has no options (amount-only project), else none. */
export function initialChoice(p: DonateProject): string | null {
  return p.options && p.options.length === 0 && p.allowOpenAmount ? OPEN_AMOUNT : null;
}

/**
 * D-01: one gift line from the box's state — an option × quantity, or an open amount on the project. `amount` is the
 * amount field's normalised value (null when invalid). Returns why not when the state is incomplete.
 */
export function donateDraft(
  p: DonateProject,
  choice: string | null,
  quantity: number,
  amount: string | null,
): { draft: CartDraft } | { error: 'choose' | 'amount' } {
  const preview = { titleAr: p.titleAr, titleEn: p.titleEn, slug: p.slug };
  if (choice === OPEN_AMOUNT) {
    if (!p.allowOpenAmount) return { error: 'choose' };
    return amount
      ? { draft: { kind: 'project', projectId: p.id, amount, preview } }
      : { error: 'amount' };
  }
  const option = p.options?.find((o) => o.id === choice);
  if (!option) return { error: 'choose' };
  return {
    draft: {
      kind: 'option',
      projectId: p.id,
      optionId: option.id,
      quantity,
      unitAmount: option.amount,
      preview: { ...preview, optionLabelAr: option.labelAr, optionLabelEn: option.labelEn },
    },
  };
}
