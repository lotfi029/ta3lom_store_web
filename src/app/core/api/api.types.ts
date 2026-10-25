/**
 * Named aliases over the GENERATED `store-api.types.ts` (openapi-typescript, `npm run types:gen`, snapshot from the R5
 * store API — DECISIONS D-W1). Nothing here is a hand-written shape — every alias points into `components['schemas']`
 * or `paths`. The wire-value unions below only name the string values the contract lists for fields the OpenAPI
 * document types as plain `string` (contract 15 §1.9).
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

/** The API serialises int32 as `number | string` (OpenAPI pattern) — read them through this. */
export function toInt(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Wire values (contract 15 §1.9)
export type ProjectStatus = 'draft' | 'published' | 'archived';
export type ProjectBadge = 'new' | 'urgent';
export type OrderStatusValue =
  'pending_payment' | 'paid' | 'payment_review' | 'cancelled' | 'expired';
export type CustomerStatus = 'active' | 'blocked' | 'anonymised';
export type TargetKind = 'project' | 'category';
export type CatalogSort = 'featured' | 'newest' | 'title';
export const CATALOG_SORTS: readonly CatalogSort[] = ['featured', 'newest', 'title'];

// Catalogue (public)
export type HomeResponse = Schemas['HomeResponse'];
export type Category = Schemas['CategorySummary'];
export type CategoryRef = Schemas['CategoryRef'];
export type ProjectCard = Schemas['ProjectCard'];
export type ProjectPage = Paged<ProjectCard>;
export type ProjectDetail = Schemas['ProjectDetail'];
export type ProjectOption = Schemas['ProjectOptionView'];
export type SlugRedirect = Schemas['SlugRedirectResponse'];
export type ProjectSlugs = Schemas['ProjectSlugsResponse'];
export type CatalogConfig = Schemas['CatalogConfigResponse'];

/** The list envelope `{ items, total, page, pageSize }` (contract 15 §1.5). */
export interface Paged<T> {
  items: T[];
  total: number | string;
  page: number | string;
  pageSize: number | string;
}

// Donor auth
export type SessionResponse = Schemas['SessionResponse'];
export type CustomerSession = Schemas['CustomerSessionResponse'];
export type AccessTokenResponse = Schemas['AccessTokenResponse'];
export type OtpRequestedResponse = Schemas['OtpRequestedResponse'];
export type CartNotice = Schemas['CartNoticeResponse'];

// Cart, checkout, order status
export type Cart = Schemas['CartResponse'];
export type CartLine = Schemas['CartLineResponse'];
export type CartProblem = Schemas['CartProblemResponse'];
export type CartBadge = Schemas['CartSummaryResponse'];
export type AddCartLine = Schemas['AddCartLineRequest'];
export type UpdateCartLine = Schemas['UpdateCartLineRequest'];
export type CheckoutRequest = Schemas['CheckoutRequest'];
export type CheckoutResponse = Schemas['CheckoutResponse'];
export type OrderStatus = Schemas['OrderStatusResponse'];

// Me
export type Me = Schemas['MeResponse'];
export type UpdateMe = Schemas['UpdateMeRequest'];
export type DonationSummary = Schemas['DonationSummary'];
export type DonationPage = Schemas['PagedResultOfDonationSummary'];
export type DonationDetail = Schemas['DonationDetail'];
export type DonationLine = Schemas['DonationLineResponse'];
export type MeExport = Schemas['MeExportResponse'];

// Staff auth
export type StaffLoginResponse = Schemas['StaffLoginResponse'];
export type StaffSessionResponse = Schemas['StaffSessionResponse'];
export type StaffMe = Schemas['StaffMeResponse'];
export type TotpSetupResponse = Schemas['TotpEnrolResponse'];
export type ChangePassword = Schemas['ChangePasswordRequest'];

// Admin catalogue
export type AdminCategory = Schemas['AdminCategoryResponse'];
export type CategoryInput = Schemas['CategoryInput'];
export type CategoryOrderInput = Schemas['CategoryOrderInput'];
export type AdminProjectRow = Schemas['AdminProjectRow'];
export type AdminProjectPage = Schemas['PagedResultOfAdminProjectRow'];
export type AdminProject = Schemas['AdminProjectResponse'];
export type AdminProjectOption = Schemas['AdminProjectOption'];
export type ProjectInput = Schemas['ProjectInput'];
export type ProjectOptionsInput = Schemas['ProjectOptionsInput'];
export type ProjectOptionInput = Schemas['ProjectOptionInputItem'];
export type MediaAsset = Schemas['MediaAssetResponse'];
export type MediaPage = Schemas['PagedResultOfMediaAssetResponse'];
export type MediaAltInput = Schemas['MediaAltInput'];

// Admin operations
export type Dashboard = Schemas['DashboardResponse'];
export type DashboardProject = Schemas['DashboardProject'];
export type AdminCustomerRow = Schemas['AdminCustomerRow'];
export type AdminCustomerPage = Schemas['PagedResultOfAdminCustomerRow'];
export type AdminCustomer = Schemas['AdminCustomerDetail'];
export type AdminOrderRow = Schemas['AdminOrderRow'];
export type AdminOrderPage = Schemas['PagedResultOfAdminOrderRow'];
export type AdminOrderDetail = Schemas['AdminOrderDetail'];
export type AdminOrderLine = Schemas['AdminOrderLine'];
export type Setting = Schemas['SettingResponse'];
export type MessageTemplate = Schemas['TemplateResponse'];
export type TemplateInput = Schemas['TemplateInput'];
export type TemplateTest = Schemas['TemplateTestRequest'];
export type TemplateTestResult = Schemas['TemplateTestResponse'];
export type AuditRow = Schemas['AuditRow'];
export type AuditPage = Schemas['PagedResultOfAuditRow'];

// Staff
export type StaffUser = Schemas['StaffUserResponse'];
export type CreateStaff = Schemas['CreateStaffRequest'];
export type UpdateStaff = Schemas['UpdateStaffRequest'];
export type CreateStaffResult = Schemas['CreateStaffResponse'];
export type OneTimePassword = Schemas['OneTimePasswordResponse'];
