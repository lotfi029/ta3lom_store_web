/**
 * Named aliases over the GENERATED `store-api.types.ts` (openapi-typescript, `npm run types:gen`). Nothing here is a
 * hand-written shape — every alias points into `components['schemas']` or `paths`. Add aliases as screens need them.
 */
import type { components, paths } from './store-api.types';

export type Schemas = components['schemas'];
export type Paths = paths;

/** Request body of an operation, e.g. `RequestBody<'/v1/cart/lines', 'post'>`. */
export type RequestBody<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

// Auth (#16–#20, #47–#52)
export type SessionResponse = Schemas['SessionResponse'];
export type CustomerSession = Schemas['CustomerSessionResponse'];
export type AccessTokenResponse = Schemas['AccessTokenResponse'];
export type OtpRequestedResponse = Schemas['OtpRequestedResponse'];
export type CartNotice = Schemas['CartNoticeResponse'];
export type StaffLoginResponse = Schemas['StaffLoginResponse'];
export type StaffSessionResponse = Schemas['StaffSessionResponse'];
export type StaffMe = Schemas['StaffMeResponse'];
export type TotpEnrolResponse = Schemas['TotpEnrolResponse'];

// Cart (#11)
export type CartBadge = Schemas['CartBadgeResponse'];

/** The API serialises int32 as `number | string` (OpenAPI pattern) — read them through this. */
export function toInt(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
