import { normalizeSaudiMobile, westernDigits } from '../../../core/i18n/western-digits';

/** A donation reference as the API issues it: `T3-<yy>-<6 digits>` (API `Order.cs`). */
export const REFERENCE_RE = /^T3-\d{2}-\d{6}$/i;
/** Something that starts like a reference (`T3-26`, `t3-26-0001`): searched, not opened. */
const PARTIAL_REFERENCE_RE = /^T3-[\d-]*$/i;

export type PaletteTarget =
  | { kind: 'order'; reference: string }
  | { kind: 'reference'; reference: string }
  | { kind: 'mobile'; mobile: string }
  | { kind: 'text'; q: string }
  | { kind: 'empty' };

/**
 * What the command palette does with the typed text (docs/admin-redesign/03 §3): a full reference opens the donation,
 * a partial one or a Saudi mobile searches donations, anything else filters the screens and searches projects.
 */
export function paletteTarget(raw: string): PaletteTarget {
  const text = westernDigits(raw).trim();
  if (!text) return { kind: 'empty' };
  const compact = text.replace(/\s+/g, '');
  if (REFERENCE_RE.test(compact)) return { kind: 'order', reference: compact.toUpperCase() };
  if (PARTIAL_REFERENCE_RE.test(compact) && compact.length > 3)
    return { kind: 'reference', reference: compact.toUpperCase() };
  const mobile = normalizeSaudiMobile(text);
  if (mobile) return { kind: 'mobile', mobile };
  return { kind: 'text', q: text };
}
