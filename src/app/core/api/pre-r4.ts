/**
 * The ONLY place the store web touches giving-era fields (DECISIONS: pre-r4 API, REVIEW). The API on `main` still
 * requires them on a cart line; a purchase sends their neutral values. When the r4 API lands these disappear from the
 * OpenAPI file, `types:gen` drops them and this file goes.
 */
export const PURCHASE_LINE = {
  kind: 'buy',
  mode: 'units',
  amount: null,
  intent: null,
  dedication: null,
} as const;
