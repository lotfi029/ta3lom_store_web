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

// Catalogue (#1–#5, #9)
export type HomeResponse = Schemas['HomeResponse'];
export type ProductCard = Schemas['ProductCardResponse'];
export type ProductPage = Schemas['PagedResultOfProductCardResponse'];
export type ProductDetail = Schemas['ProductDetailResponse'];
export type CourseBlock = Schemas['CourseBlock'];
export type BookBlock = Schemas['BookBlock'];
export type BookFormat = Schemas['BookFormatResponse'];
export type CourseModule = Schemas['CourseModuleResponse'];
export type RelatedProduct = Schemas['RelatedProduct'];
export type Category = Schemas['CategoryResponse'];
export type CategoryRef = Schemas['CategoryRef'];
export type CoverImage = Schemas['ImageResponse'];
export type LiveFigures = Schemas['LiveFiguresResponse'];
export type LiveItem = Schemas['LiveItem'];
export type LiveFormat = Schemas['LiveFormat'];
export type CatalogConfig = Schemas['CatalogConfigResponse'];

/** r4: the storefront sells these two product types only. */
export type StoreProductType = 'course' | 'book';
export const isStoreProduct = (p: { type: string }): boolean => p.type === 'course' || p.type === 'book';

// Cart (#10–#15)
export type Cart = Schemas['CartResponse'];
export type CartLine = Schemas['CartLineResponse'];
export type CartTotals = Schemas['CartSummaryResponse'];
export type AddCartLine = Schemas['AddCartLineRequest'];

// Account (#21–#39)
export type Enrolment = Schemas['EnrolmentItem'];
