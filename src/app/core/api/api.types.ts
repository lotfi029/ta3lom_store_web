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

// Admin platform (#118–#128, #133)
export type StaffUser = Schemas['StaffUserResponse'];
export type CreateStaff = Schemas['CreateStaffRequest'];
export type UpdateStaff = Schemas['UpdateStaffRequest'];
export type CreateStaffResult = Schemas['CreateStaffResponse'];
export type OneTimePassword = Schemas['OneTimePasswordResponse'];
export type Setting = Schemas['SettingResponse'];
export type MessageTemplate = Schemas['TemplateResponse'];
export type TemplateUpdate = Schemas['TemplateUpdateRequest'];
export type TemplateTest = Schemas['TemplateTestRequest'];
export type TemplateTestResult = Schemas['TemplateTestResponse'];
export type AuditEntry = Schemas['AuditEntry'];
export type AuditPage = Schemas['PagedResultOfAuditEntry'];

// Admin catalogue (#54–#62, #64–#66, #72–#80)
export type AdminProductRow = Schemas['AdminProductRow'];
export type AdminProductPage = Schemas['PagedResultOfAdminProductRow'];
export type AdminProduct = Schemas['AdminProductResponse'];
export type AdminFormat = Schemas['AdminBookFormat'];
export type AdminModule = Schemas['AdminModule'];
export type ProductInput = Schemas['ProductInput'];
export type CourseDetailInput = Schemas['CourseDetailInput'];
export type CourseModuleInput = Schemas['CourseModuleInput'];
export type BookDetailInput = Schemas['BookDetailInput'];
export type BookFormatInput = Schemas['BookFormatInput'];
export type AdminCategory = Schemas['AdminCategoryResponse'];
export type CategoryInput = Schemas['CategoryInput'];
export type MediaAsset = Schemas['MediaAssetResponse'];
export type MediaPage = Schemas['PagedResultOfMediaAssetResponse'];
export type MediaAltInput = Schemas['MediaAltInput'];
export type StockRow = Schemas['StockRow'];
export type StockMovement = Schemas['StockMovementResponse'];
export type StockMovementPage = Schemas['PagedResultOfStockMovementResponse'];
export type StockMovementRequest = Schemas['StockMovementRequest'];

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
export const isStoreProduct = (p: { type: string }): boolean =>
  p.type === 'course' || p.type === 'book';

// Cart (#10–#15)
export type Cart = Schemas['CartResponse'];
export type CartLine = Schemas['CartLineResponse'];
export type CartTotals = Schemas['CartSummaryResponse'];
export type AddCartLine = Schemas['AddCartLineRequest'];

// Checkout (#40–#41)
export type Quote = Schemas['QuoteResponse'];
export type QuoteLine = Schemas['QuoteLine'];
export type CheckoutRequest = Schemas['CheckoutRequest'];
export type CheckoutResponse = Schemas['CheckoutResponse'];
export type AddressInput = Schemas['AddressInput'];
export type Address = Schemas['AddressResponse'];
export type Profile = Schemas['ProfileResponse'];
export type OrderStatus = Schemas['OrderStatusResponse'];
export type StatusPurchase = Schemas['StatusPurchase'];
export type StatusDocument = Schemas['StatusDocument'];

// Account (#21–#39)
export type UpdateProfile = Schemas['UpdateProfileRequest'];
export type LaunchResponse = Schemas['LaunchResponse'];
export type BooksResponse = Schemas['BooksResponse'];
export type BookDownload = Schemas['BookDownloadItem'];
export type BookShipment = Schemas['BookShipmentItem'];
export type DownloadLink = Schemas['DownloadLinkResponse'];
export type OrderSummary = Schemas['OrderSummary'];
export type OrderPage = Schemas['PagedResultOfOrderSummary'];
export type OrderDetail = Schemas['OrderDetailResponse'];
export type OrderLine = Schemas['OrderLineResponse'];
export type OrderDocument = Schemas['OrderDocumentItem'];
export type Enrolment = Schemas['EnrolmentItem'];
