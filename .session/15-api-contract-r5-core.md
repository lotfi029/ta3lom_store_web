# 15: Store API HTTP contract (R5-Core, main @ 7b2e22e — derived from code)

Source: `lotfi029/…/api` at `main` **7b2e22e** (ASP.NET Core minimal APIs, .NET 10). No OpenAPI file is committed; everything below is read from
`src/Ta3lom.Store.Api` (endpoints, security, filters), `src/Ta3lom.Store.Application` (DTOs, handlers, FluentValidation validators),
`src/Ta3lom.Store.Domain` (errors, enums, constants, value objects) and `appsettings*.json`. In Development the live OpenAPI is at
`/openapi/v1.json` and Scalar at `/docs`.

---

## 1. Conventions

### 1.1 Base path, hosts, versioning

| Item | Value |
|---|---|
| API base path | `/v1` (one `MapGroup("/v1")`, CORS policy `web` applied to the whole group) |
| Unversioned | `/health/live`, `/health/ready` (no CORS), `/dev/*` (Development only), `/files/public/*` (static files), `/openapi/v1.json` + `/docs` (Development only) |
| Public base URL (problem `type`) | `Store:PublicBaseUrl`: prod `https://store-api.ta3lom.sa`, staging `https://store-api-staging.ta3lom.sa`, dev `https://localhost:7180` |
| Web base URL (links in SMS/e-mail) | `Store:WebBaseUrl`: prod `https://store.ta3lom.sa`, staging `https://store-staging.ta3lom.sa`, dev `http://localhost:4200` |
| Public files | `GET /files/public/{storageKey}` served from `Store:Files:Root/public`, `Cache-Control: public, max-age=86400`. URLs in DTOs are absolute: `{Store:Files:PublicBaseUrl}/{storageKey}` (prod default `https://store-api.ta3lom.sa/files/public/…`, dev `http://localhost:5080/files/public/…`). Keys: `images/{yyyy}/{id:N}.webp`, `pdf/{yyyy}/{id:N}.pdf` |
| Language | `Accept-Language` → `ar` (default) or `en`. Only affects problem `title`/`detail`. Catalogue bodies are bilingual (`…Ar` / `…En` fields) |

### 1.2 JSON

* No custom `JsonOptions` are registered → ASP.NET Core **web defaults**: property names **camelCase** (`titleAr`, `pageSize`, `isActive`),
  reading is case-insensitive, numbers may also be read from JSON strings (`"quantity": "2"` is accepted), `null` values are written
  (not omitted). Dictionary keys are **not** camel-cased (they are written as stored: e.g. `errors` keys are already camelCase,
  `/dev/jobs` keys are PascalCase job names).
* There is **no** `JsonStringEnumConverter`: every enum-like field in DTOs is already a `string` produced by `EnumWire.ToWire()`
  (snake_case of the C# name). See 1.9.
* Missing JSON properties bind to the C# default of the record parameter: `false` for `bool`, `0` for `int`/`uint`, `null` for
  reference/nullable types. E.g. omitting `isActive` in `CategoryInput` means `false`; omitting `version` in `ProjectOptionsInput` or
  `UpdateStaffRequest` means `0` (→ 409 `concurrency.conflict`).
* A body that cannot be bound (malformed JSON, wrong JSON type, missing/empty body on a `[FromBody]` route) → `BadHttpRequestException`
  → **400 `validation.failed` without an `errors` member**. Wrong `Content-Type` → 415 `http.error`. Every POST/PUT/PATCH route that
  declares a body requires a JSON body (send `{}` for `POST /v1/checkout` with no overrides).
* IDs are GUIDs (UUID v7 for new rows) as strings. Route constraints `{id:guid}` → a non-GUID segment is **404** (no route matched).
* `version` fields are `uint` JSON numbers (PostgreSQL `xmin`), echoed back on updates for optimistic concurrency.
* Settings values are raw `JsonElement` (`value` may be a string, number, array or `null`).

### 1.3 Money

* Responses: always a **string** with exactly two decimals, invariant culture: `"50.00"`, `"0.00"` (`Money.ToWire()`; never a JSON number).
* Inputs (`amount`, `minAmount`, option `amount`, money settings): a JSON **string**, regex `^[0-9]{1,10}(\.[0-9]{1,2})?$` after
  normalisation (`"50"`, `"50.5"`, `"50.00"`). Arabic-Indic (U+0660–0669) and Eastern Arabic (U+06F0–06F9) digits and the Arabic decimal
  separator `٫` (U+066B) are mapped to ASCII first. Group separators (`,`, U+066C), signs, spaces, exponents → invalid. Max
  `9999999999.99`; value is rounded half-away-from-zero to 2 dp. Where "positive" is required, `0` is invalid.
* Currency is implicit SAR.

### 1.4 Dates

* Instants: `DateTimeOffset` → ISO 8601 with offset as produced by System.Text.Json, e.g. `"2026-10-25T12:53:17.123456+00:00"` (values
  from PostgreSQL `timestamptz` come back in UTC, `+00:00`).
* Query dates (`from`, `to` on `/v1/admin/orders`): `DateOnly` `YYYY-MM-DD`, interpreted as **Riyadh (UTC+3) calendar days, inclusive**.
  An unparseable date → 400 (binding).
* "Today"/"this week" on the dashboard: Riyadh dates; week starts on **Sunday**.
* Order reference: `T3-YY-NNNNNN` (YY = Riyadh year mod 100, NNNNNN = `order_ref_seq`, zero-padded to 6). Stored upper-case.

### 1.5 Paging

* Query `page` (1-based, default 1) and `pageSize` (default 20; **50** for `/v1/admin/audit`), max 100.
* Response `PagedResult<T>`: `{ items: T[], total: number, page: number, pageSize: number }` — `page` = `max(page,1)`, `pageSize` = the
  clamped value actually used.
* Endpoints with a validator reject `page < 1` or `pageSize ∉ [1,100]` with 400 `validation.failed`. **`GET /v1/admin/media` has no
  validator**: out-of-range values are silently clamped.

### 1.6 Authentication

Three JWT bearer schemes (HMAC-SHA256, `kid` header = `Store:Jwt:KeyId` default `k1`), same issuer `Store:Jwt:Issuer` (default
`https://store-api.ta3lom.sa`), `ClockSkew` 30 s, `MapInboundClaims = false`, name claim `sub`, role claim `role`. Header:
`Authorization: Bearer <token>`.

| Scheme | Audience | Signing key | Lifetime (`expiresIn`) | Claims | Issued by |
|---|---|---|---|---|---|
| `Customer` | `store-customer` | `Store:Jwt:CustomerSigningKeyBase64` | 15 min (900 s) | `sub` (customer id), `jti`, `iss`, `aud`, `iat`, `nbf`, `exp` | `POST /v1/auth/otp/verify`, `POST /v1/auth/refresh` |
| `Staff` | `store-staff` | `Store:Jwt:StaffSigningKeyBase64` | 10 min (600 s) | `sub`, `email`, one `role` claim per role, `pwd_change: "true"` only while a forced password change is pending, `jti`, … | `POST /v1/admin/auth/totp/verify`, `/password`, `/refresh` |
| `StaffMfa` | `store-staff-mfa` | staff key | 5 min | `sub`, `jti`, … | `POST /v1/admin/auth/login` (`mfaToken`) |

Policies (`Policies.*`):

| Policy | Scheme | Rule |
|---|---|---|
| `customer` | Customer | authenticated donor |
| `customer-optional` | Customer | passes for guests (no `Authorization` header); if an `Authorization` header is present it must be a **valid customer** token, otherwise **401** (so the web app refreshes). A staff token on cart routes → 401 |
| `staff-mfa` | StaffMfa | valid MFA step token |
| `staff-password-change` | Staff | any authenticated staff token, **even with `pwd_change`**, no role check (only `POST /v1/admin/auth/password`) |
| `staff:read` | Staff | roles any of `admin, store_manager, finance, viewer` + no pending password change |
| `staff:catalogue` | Staff | `admin, store_manager` + no pending password change |
| `staff:customers` | Staff | `admin, store_manager` + … |
| `staff:orders` | Staff | `admin, finance` + … |
| `staff:templates` | Staff | `admin, store_manager` + … |
| `staff:admin` | Staff | `admin` + … |
| fallback | Customer or Staff | any route without its own policy/`AllowAnonymous` needs a valid customer or staff token (all mapped routes declare one) |

**`pwd_change` behaviour.** While `staff_user.must_change_password` is true every staff access token carries `pwd_change=true` (recomputed
on every issue, so it survives `/refresh`). Every `staff:*` policy then fails with **403 `auth.password_change_required`** (custom
`IAuthorizationMiddlewareResultHandler`). Only `POST /v1/admin/auth/password` (policy `staff-password-change`), `POST /v1/admin/auth/refresh`
and `POST /v1/admin/auth/logout` (anonymous, cookie) work. Note: `GET /v1/admin/me` uses `staff:read`, so it is **also 403** while the change is
pending — use `staff` in the `StaffSessionResponse` (`mustChangePassword: true`) instead. After a successful password change all refresh
families of the member are revoked and a new session (token without `pwd_change`) + new `t3s_srt` cookie is returned.

Default auth failures (from the framework, rendered as problem details by `UseStatusCodePages`): 401 `auth.unauthenticated` (with
`WWW-Authenticate: Bearer …`), 403 `auth.forbidden` (wrong role / wrong scheme).

Staff sign-in flow: `POST /admin/auth/login` → `{ mfaToken, totpEnrolled }` → (if `totpEnrolled` is false) `POST /admin/auth/totp/enrol`
with `Bearer mfaToken` → `{ otpauthUri, secretBase32 }` → `POST /admin/auth/totp/verify` `{ code }` with `Bearer mfaToken` → session. The
MFA token is single use at `totp/verify` (its `jti`); `totp/enrol` may be repeated until the first accepted code confirms the enrolment.
5 failures (password, TOTP or current password) within 15 min lock the account for 1 h.

### 1.7 Cookies

All cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, **host-only** (no `Domain`), `IsEssential`. Web app must call with
`credentials: 'include'`.

| Cookie | Content | Path | Max-Age | Set by | Cleared by |
|---|---|---|---|---|---|
| `t3s_rt` | donor refresh token (opaque) | `/v1/auth` | until the token's expiry: 30 days per token, never past the 60-day family | `otp/verify`, `auth/refresh` | `auth/refresh` on any failure **except** 409 `auth.refresh_race`; `auth/logout`; `auth/logout-all`; `DELETE /v1/me` |
| `t3s_srt` | staff refresh token | `/v1/admin/auth` | until the 8-hour family expiry (rotation never extends it) | `admin/auth/totp/verify`, `/password`, `/refresh` | `admin/auth/refresh` on failure except 409; `admin/auth/logout` |
| `t3s_cart` | guest cart id, Data-Protection sealed (purpose `Store.Cart.v1`) | `/v1` | 30 days | every successful **guest cart write** (`POST/PATCH/DELETE /v1/cart/lines…`) — rewritten each time, so 30 days from the last change | `otp/verify` (when a valid guest cookie was sent; the cart is merged), `DELETE /v1/me` |

A tampered/foreign/expired `t3s_cart` reads as "no cart". Refresh tokens travel **only** in cookies (never in JSON). Because `t3s_rt`'s path is
`/v1/auth`, it is sent only to `/v1/auth/*`.

### 1.8 Origin check, CORS, security headers

**Origin check** (`RequireSameOrigin()` filter → `403 http.origin_forbidden`): applies to non-GET/HEAD/OPTIONS requests that carry an
`Origin` header not in `Store:Cors:Origins` (exact, case-insensitive). Requests without `Origin` pass. Applied to groups: `/v1/auth`,
`/v1/cart`, `/v1/checkout`, `/v1/me`, `/v1/admin/auth` (not `/v1/admin/me`, GET anyway), `/v1/admin/categories`, `/v1/admin/projects`,
`/v1/admin/media`, `/v1/admin/{dashboard,customers,orders,templates,audit}`, `/v1/admin/settings`, `/v1/admin/staff`. **Not** applied to
`/v1/catalog/*` and `/v1/orders/{reference}/status` (both GET-only).

**CORS** (policy `web`, `/v1/*` only):

| Setting | Value |
|---|---|
| Origins (Production — `appsettings.json`) | `https://store.ta3lom.sa`, `https://store-staging.ta3lom.sa` |
| Origins (Staging — not overridden) | same two |
| Origins (Development) | `https://store.ta3lom.sa`, `https://store-staging.ta3lom.sa`, `http://localhost:4200` |
| Credentials | allowed |
| Methods | `GET, POST, PUT, PATCH, DELETE` |
| Request headers | `Authorization`, `Content-Type`, `Idempotency-Key`, `Accept-Language` (anything else, e.g. a manually-set `If-None-Match`, fails preflight) |
| Exposed headers | `ETag`, `Retry-After`, `Location`, `Idempotent-Replayed` |
| Preflight max-age | 600 s |

**Security headers** on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `X-Frame-Options: DENY`,
`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (not on `/docs`, `/openapi` in Development), HSTS 365 d +
`includeSubDomains` outside Development, no `Server` header. **`Cache-Control: no-store`** on every path under `/v1/me`, `/v1/auth`,
`/v1/admin`, `/v1/checkout`, `/v1/cart`, `/v1/orders`, `/v1/downloads`.

### 1.9 Enum wire values

| Enum | Values |
|---|---|
| Project `status` | `draft`, `published`, `archived` (D-07: draft→published, published→archived, archived→published) |
| Project `badge` | `new`, `urgent` (or `null`) |
| Order `status` | `pending_payment`, `paid`, `payment_review`, `cancelled`, `expired` (this release only sets `pending_payment` and `cancelled`) |
| Customer `status` | `active`, `blocked`, `anonymised` |
| Line `targetKind` | `project`, `category` |
| Media `kind` | `image`, `pdf` |
| Template `channel` | `sms`, `email` |
| Staff roles | `admin`, `store_manager`, `finance`, `viewer` |
| Locale | `ar`, `en` |
| Catalogue `sort` | `featured` (default: project `sort`, then created), `newest` (publishedAt desc), `title` (titleAr asc). With `q` the order is search rank |
| Cart merge notice `code` | `cart.merge_combined`, `cart.merge_dropped` |
| Line problem codes | `cart.target_unavailable`, `cart.option_unavailable`, `cart.open_amount_not_allowed`, `cart.amount_below_minimum`, `cart.amount_above_maximum`; cart-level (`lineId: null`): `cart.too_many_lines`, `cart.total_exceeded` |
| Password weakness `reasons` | `too_short` (<12), `too_long` (>128), `common` (on the embedded list or one repeated char), `same_as_current` |
| Publish `missing` | `titleAr`, `summaryAr`, `bodyAr`, `cover`, `category`, `amount` (no open amount and no active option) |
| Health `status` | `Healthy`, `Degraded`, `Unhealthy` (PascalCase) |

### 1.10 Idempotency-Key

Only `POST /v1/checkout` (scope prefix `checkout`, **required**).

* Header `Idempotency-Key`, length **8–64** characters (else 400 `validation.failed`, `errors: { "Idempotency-Key": ["8–64 characters."] }`).
  Missing/empty → 400 `idempotency.key_required`.
* Scope = `checkout:{sub}` (per donor). Request hash = SHA-256 of the canonical JSON of the bound body (`CheckoutRequest`).
* Same key + same body after a **2xx** → stored response replayed: same status (201), same JSON body (the `statusToken` is re-derived, not
  stored), `Location` header restored, plus `Idempotent-Replayed: true`.
* Same key + different body → **422 `idempotency.key_reused`**. Same key while the first request is still running → **409
  `idempotency.in_progress`** (a claim older than 2 min is considered crashed and taken over).
* Only 2xx outcomes are stored. Any 4xx/5xx releases the key, so the client may retry with the same key after fixing the problem.
* Retention 24 h. Additionally the order row keeps the key: a retry whose stored response was lost gets the order that key placed.

### 1.11 Caching / ETag (public catalogue)

All five `GET /v1/catalog/*` routes use `CachedContent()`:

* Response headers on 200: `ETag: W/"<32 hex>"` (first 16 bytes of SHA-256 of the serialized JSON body),
  `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
* `If-None-Match` matching the ETag (comma list, or `*`) → **304** with no body.
* Server output cache: 60 s per URL, varying only by query keys `q, category, sort, page, pageSize, fields` (other keys share the entry;
  not varied by `Accept-Language`; ASP.NET default policy → not used for requests with an `Authorization` header). Tag `catalog` is
  evicted after any successful (2xx) non-GET on: admin categories (create/update/order), admin projects (create/update/options/publish/
  archive), `PATCH /v1/admin/media/{id}`, `PUT /v1/admin/settings/{key}`. (Media **upload** does not evict.)
* Errors (404, 400) carry no ETag/Cache-Control from this filter. A defined `CachedLive()` (max-age 15) is currently unused.

### 1.12 Rate limits

In-memory per container. Partition key = HMAC of the client IP (after forwarded headers, trusted only from `Store:ForwardedHeaders`:
prod `172.16.0.0/12`, dev `127.0.0.0/8`) — or the token `sub` where noted. Rejection → **429** problem `code: "http.rate_limited"` +
`Retry-After: <seconds>` (from the limiter lease, else `Public.ReplenishmentPeriodSeconds` = 1; min 1). No `retryAfterSeconds` member on
limiter 429s.

| Policy | Algorithm | Default limit | Key | Used by |
|---|---|---|---|---|
| `public` | token bucket | burst 40, +2 tokens/s (≈120/min) | IP | `/v1/catalog/*`, `GET /v1/orders/{reference}/status` |
| `otp-request` | fixed window | 10 / 3600 s | IP | `POST /v1/auth/otp/request` |
| `otp-verify` | fixed window | 30 / 900 s | IP | `POST /v1/auth/otp/verify` |
| `auth-refresh` | sliding (6 segments) | 30 / 60 s | IP | `/v1/auth/refresh`, `/logout`, `/logout-all`, `/v1/admin/auth/refresh`, `/v1/admin/auth/logout` |
| `staff-login` | fixed | 10 / 900 s | IP | `/v1/admin/auth/login`, `/totp/enrol`, `/totp/verify`, `/password` |
| `cart` | sliding | 60 / 60 s | IP | `/v1/cart/*`, `POST /v1/checkout/quote` |
| `checkout` | fixed | 10 / 60 s | `sub` (else IP) | `POST /v1/checkout` |
| `me` | sliding | 120 / 60 s | `sub` | `/v1/me/*` |
| `download` | fixed | 10 / 60 s | `sub` | (defined, **no route uses it**) |
| `admin` | sliding | 300 / 60 s | `sub` | all `/v1/admin/*` except `/v1/admin/auth/*` |
| `template-test` | fixed | 5 / 3600 s | `sub` | `POST /v1/admin/templates/test` (in addition to `admin`) |

Business-level 429s (not the limiter): `otp.rate_limited` (3 codes / mobile / 15 min, 10 / IP / hour, 2000 store-wide / Riyadh day) carries
`retryAfterSeconds` **and** a `Retry-After` header; `otp.too_many_attempts` (5 wrong codes on the open code) carries neither.

### 1.13 Problem details (RFC 9457)

`Content-Type: application/problem+json`. Shape:

```ts
interface Problem {
  type: string;        // `${PublicBaseUrl}/problems/${code}` e.g. "https://store-api.ta3lom.sa/problems/cart.line_not_found"
  title: string;       // localized (ar default / en) from ErrorMessages*.resx, keyed by code; falls back to the English description
  status: number;
  detail?: string;     // localized `${code}.detail` when present
  code: string;        // stable machine code (section 4)
  traceId: string;     // W3C trace id (32 hex)
  // extra members (only on the codes listed):
  errors?: Record<string, string[]>;   // validation.failed from validators / filters
  attemptsLeft?: number;               // otp.invalid
  retryAfterSeconds?: number;          // otp.rate_limited (+ Retry-After header)
  lockedUntil?: string;                // auth.account_locked (ISO instant)
  reasons?: string[];                  // auth.password_weak
  missing?: string[];                  // project.publish_incomplete
  from?: string; to?: string;          // project.invalid_transition (project status wire values)
  label?: string;                      // project.option_label_taken
  min?: string;                        // cart.amount_below_minimum (money)
  max?: string | number;               // cart.amount_above_maximum / cart.total_exceeded (money string);
                                       // cart.quantity_limit / cart.too_many_lines (int); media.too_large (int bytes or pixels)
  problems?: { lineId: string | null; code: string }[];  // checkout.lines_invalid
  // NB: order.cancel_not_allowed adds an extension literally named "status" (the order status), which collides
  //     with the standard numeric `status` member (see section 5, item 1)
  line?: number; column?: number;      // template.render_failed
}
```

`errors` keys: camelCase field paths with the command wrapper stripped, e.g. `slug`, `titleAr`, `options[0].labelAr`, `roles[1]`, `version`,
`pageSize`, `to` (range check on `/admin/orders`), `quantity`/`amount` (PATCH cart line). Root-object rules on cart requests use the key
**`request`** (`"Send { projectId, optionId, quantity }, { projectId, amount } or { categoryId, amount }."`, `"Send either quantity or amount."`).
Messages are English FluentValidation texts (not localized).

Framework / exception mapping: unbound body → 400 `validation.failed` (no `errors`); other `BadHttpRequestException` (413 body too large,
415) → `http.error`; unmatched route → 404 problem `http.not_found` (written by status-code pages);
405 → `http.error`; stale `xmin` on save → 409 `concurrency.conflict`; PG unique violation → 409 `db.duplicate`; PG FK violation → 422
`db.reference_missing`; `DomainException` (invariant guard) → **409 with the guard's code** (e.g. `customer.not_active`,
`project.option_label_duplicate`, `money.precision` …); anything else → 500 `server.error` (no stack trace).

---

## 2. Endpoints

Legend: **RL** = rate-limit policy, **SO** = same-origin filter applied, **C** = catalogue-cache evicting. All paths below are relative to
the host; `/v1` included.

### 2.1 Catalogue (public) — `AllowAnonymous`, RL `public`, ETag/cache (1.11), no SO

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/v1/catalog/home` | — | 200 `HomeResponse` (6 featured cards: badged first, then `sort`; active categories; presets) | — |
| GET | `/v1/catalog/categories` | — | 200 `CategorySummary[]` (active only, order `sort`, `nameAr`) | — |
| GET | `/v1/catalog/config` | — | 200 `CatalogConfigResponse` | — |
| GET | `/v1/catalog/projects` | query: `q?` string ≤100 (Arabic-aware search); `category?` category **slug** ≤60 (unknown → empty page); `sort?` `featured\|newest\|title`; `page` int ≥1 =1; `pageSize` 1–100 =20; `fields?` — when present (any value) the route switches to the slugs list and **must equal `slug`** | 200 `PagedResult<ProjectCard>`; with `fields=slug`: 200 `ProjectSlugsResponse` (all published slugs, alphabetical) | 400 `validation.failed` (`q`, `category`, `sort`, `page`, `pageSize`, `fields`) |
| GET | `/v1/catalog/projects/{slug}` | path `slug` | 200 `ProjectDetail` (published project in an active category; active options) **or** 200 `SlugRedirectResponse` `{ redirectTo }` when `slug` is an old slug of a published project in an active category (D-08). Discriminate by presence of `redirectTo` | 404 `project.not_found` |

Only projects with `status = published` in **active** categories appear anywhere public.

### 2.2 Donor auth — group `/v1/auth`, SO

| Method | Path | Auth | RL | Request | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/v1/auth/otp/request` | anonymous | `otp-request` | `RequestOtpRequest` `{ mobile: string (required, ≤20), locale?: "ar"\|"en" }` | **202** `OtpRequestedResponse` `{ expiresInSeconds: 300 }` (same answer whether or not an account exists). SMS uses template `otp`/`sms`/locale | 400 `validation.failed`; 400 `otp.mobile_invalid`; 429 `otp.rate_limited` (+`retryAfterSeconds`, `Retry-After`); 429 `http.rate_limited` |
| POST | `/v1/auth/otp/verify` | anonymous | `otp-verify` | `VerifyOtpRequest` `{ mobile: string (≤20), code: string /^[0-9]{6}$/ }`; reads `t3s_cart` | 200 `SessionResponse`; `Set-Cookie: t3s_rt`; deletes `t3s_cart` if a valid one was sent (guest cart merged; `cartNotices` reports combined/dropped lines). First sign-in creates the donor (`isNew: true`) | 400 `validation.failed`; 400 `otp.mobile_invalid`; 400 `otp.expired` (no open code / >5 min); 400 `otp.invalid` (+`attemptsLeft`); 429 `otp.too_many_attempts`; 403 `auth.account_blocked`; 429 `http.rate_limited` |
| POST | `/v1/auth/refresh` | anonymous (cookie `t3s_rt`) | `auth-refresh` | no body | 200 `AccessTokenResponse`; rotated `t3s_rt` | 401 `auth.refresh_invalid` (missing/unknown/wrong subject), 401 `auth.refresh_expired`, 401 `auth.refresh_reused` (family revoked), 403 `auth.account_blocked` (family revoked) — all clear the cookie; 409 `auth.refresh_race` (rotated <20 s ago by a parallel call; cookie kept — retry once) |
| POST | `/v1/auth/logout` | anonymous (cookie) | `auth-refresh` | no body | 204; clears `t3s_rt`; revokes the token if valid (always succeeds) | — |
| POST | `/v1/auth/logout-all` | `customer` | `auth-refresh` | no body | 204; revokes all donor families; clears `t3s_rt` | 401 |

### 2.3 Cart — group `/v1/cart`, policy `customer-optional`, RL `cart`, SO

Owner = signed-in donor (`sub`) when a customer token is sent, else the guest cart from `t3s_cart`. Guest writes create the guest cart on
first add and (re)write `t3s_cart`. Donor writes require an **active** donor.

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/v1/cart` | — | 200 `CartResponse` (re-priced from DB now; empty cart when none) | 401 (bad token) |
| GET | `/v1/cart/summary` | — | 200 `CartSummaryResponse` (stored line amounts, **not** re-priced) | 401 |
| POST | `/v1/cart/lines` | `AddCartLineRequest` — exactly one shape: `{ projectId, optionId, quantity? }` (quantity 1–999, default 1; adds to an existing line of the same option) · `{ projectId, amount, quantity?: null\|1 }` (open amount) · `{ categoryId, amount, quantity?: null\|1 }` (general gift); `amount` positive money | **200** `CartResponse` (+ `Set-Cookie: t3s_cart` for guests) | 400 `validation.failed` (`request`, `quantity`, `amount`); 403 `auth.account_blocked`; 422 `cart.target_unavailable`, `cart.option_unavailable`, `cart.open_amount_not_allowed`, `cart.amount_below_minimum` (+`min`), `cart.amount_above_maximum` (+`max`), `cart.quantity_limit` (+`max`: 999), `cart.too_many_lines` (+`max`), `cart.total_exceeded` (+`max`) |
| PATCH | `/v1/cart/lines/{id:guid}` | `UpdateCartLineRequest` — exactly one of `{ quantity: 1–999 }` (option line) or `{ amount: money>0 }` (amount line) | 200 `CartResponse` (+ cookie for guests) | 400 `validation.failed` (`request`; also `quantity`/`amount` when the wrong field for the line kind is sent); 403 `auth.account_blocked`; 404 `cart.line_not_found` (also when there is no cart); 422 `cart.quantity_limit`, `cart.total_exceeded`, `cart.amount_below_minimum` (project `minAmount` or setting), `cart.amount_above_maximum` |
| DELETE | `/v1/cart/lines/{id:guid}` | — | 200 `CartResponse` (+ cookie for guests) | 403; 404 `cart.line_not_found` |
| DELETE | `/v1/cart` | — | 204 (no cart is fine; cookie not rewritten) | 403 `auth.account_blocked` |

### 2.4 Checkout and order status

| Method | Path | Auth | RL | SO | Request | Response | Errors |
|---|---|---|---|---|---|---|---|
| POST | `/v1/checkout/quote` | `customer-optional` | `cart` | yes | no body | 200 `CartResponse` (re-priced, with `problems`; nothing written) | 409 `checkout.cart_empty`; 401 |
| POST | `/v1/checkout` | `customer` | `checkout` | yes | header `Idempotency-Key` (required, 8–64); body `CheckoutRequest` `{ fullName?: string ≤120, email?: string email ≤254, locale?: "ar"\|"en" }` — blank values fall back to the profile; supplied values are **saved to the profile** | **201** `CheckoutResponse` + `Location: /v1/orders/{reference}/status`; order `pending_payment`, `paymentDueAt = now + payment_window_minutes`; cart emptied. Replay: same 201 + `Idempotent-Replayed: true` | 400 `idempotency.key_required`; 400 `validation.failed` (`fullName`, `email`, `locale`, `Idempotency-Key`); 401; 403 `auth.account_blocked`; 409 `checkout.cart_empty`; 409 `idempotency.in_progress`; 422 `checkout.contact_required` (no name or e-mail anywhere); 422 `checkout.lines_invalid` (+`problems[]`); 422 `idempotency.key_reused` |
| GET | `/v1/orders/{reference}/status` | `customer-optional` | `public` | no | path `reference` (exact, **case-sensitive**), query `t?` = status token (from `CheckoutResponse.statusToken` or the SMS/e-mail link `…/{locale}/orders/{ref}?t=…`) | 200 `OrderStatusResponse` when caller is the order's donor **or** `t` matches | 404 `order.not_found` (also for "exists but not yours") ; 401 (bad token) |

Checkout order of checks: active donor → cart lock → (if the key already placed an order: return it) → contact → cart empty → re-price
(`lines_invalid`) → place.

### 2.5 Me — group `/v1/me`, policy `customer`, RL `me`, SO

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/v1/me` | — | 200 `MeResponse` | 401; 404 `http.not_found` (anonymised) |
| PATCH | `/v1/me` | `UpdateMeRequest` `{ fullName?: string ≤120, email?: string (email, ≤254), locale?: "ar"\|"en", marketingOptIn?: boolean }` — `null`/absent leaves a field; `""` (or whitespace) clears name/e-mail | 200 `MeResponse` | 400 `validation.failed`; 401; 403 `auth.account_blocked` |
| DELETE | `/v1/me` | — | 204; anonymises donor + order contact snapshots, revokes sessions, deletes cart; clears `t3s_rt` and `t3s_cart` | 401; 403 `auth.account_blocked` |
| GET | `/v1/me/export` | — | 200 `MeExportResponse` (profile + every order with lines, newest first) | 401; 404 `http.not_found` |
| GET | `/v1/me/donations` | `page`, `pageSize` | 200 `PagedResult<DonationSummary>` (newest first) | 400; 401 |
| GET | `/v1/me/donations/{reference}` | path `reference` (exact, case-sensitive) | 200 `DonationDetail` | 401; 404 `order.not_found` |

### 2.6 Staff auth — group `/v1/admin/auth`, SO (+ `/v1/admin/me`)

| Method | Path | Auth | RL | Request | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/v1/admin/auth/login` | anonymous | `staff-login` | `StaffLoginRequest` `{ email: email ≤254, password: string ≤256 }` (email trimmed) | 200 `StaffLoginResponse` `{ mfaToken, totpEnrolled }` | 400 `validation.failed`; 401 `auth.invalid_credentials` (unknown, inactive, wrong password **and locked** — uniform); 423 is declared but never returned |
| POST | `/v1/admin/auth/totp/enrol` | `staff-mfa` (Bearer `mfaToken`) | `staff-login` | no body | 200 `TotpEnrolResponse` (secret shown once) | 401 `auth.totp_required` (inactive/unknown) or framework 401; 409 `auth.totp_already_enrolled`; 423 `auth.account_locked` (+`lockedUntil`) |
| POST | `/v1/admin/auth/totp/verify` | `staff-mfa` | `staff-login` | `TotpVerifyRequest` `{ code: /^[0-9]{6}$/ }` (±1 step, a step is never accepted twice) | 200 `StaffSessionResponse`; `Set-Cookie: t3s_srt` | 400 `validation.failed`; 401 `auth.totp_required` (inactive, or MFA token already used), `auth.totp_not_enrolled`, `auth.totp_invalid`; 423 `auth.account_locked` (+`lockedUntil`); 503 `auth.totp_unavailable` (secret undecryptable) |
| POST | `/v1/admin/auth/password` | `staff-password-change` (staff access token, `pwd_change` allowed) | `staff-login` | `ChangePasswordRequest` `{ currentPassword: string ≤256, newPassword: string ≤128 }` | 200 `StaffSessionResponse` (fresh family; all other families revoked); `Set-Cookie: t3s_srt` | 400 `validation.failed`; 401 `auth.unauthenticated` (inactive); 422 `auth.current_password_invalid`; 422 `auth.password_weak` (+`reasons`); 423 `auth.account_locked` (+`lockedUntil`) |
| POST | `/v1/admin/auth/refresh` | anonymous (cookie `t3s_srt`) | `auth-refresh` | no body | 200 `StaffSessionResponse` (roles and `pwd_change` re-read); rotated `t3s_srt` | 401 `auth.refresh_invalid` (also inactive/locked staff: family revoked), `auth.refresh_expired`, `auth.refresh_reused`; 409 `auth.refresh_race` (cookie kept) |
| POST | `/v1/admin/auth/logout` | anonymous (cookie) | `auth-refresh` | no body | 204; clears `t3s_srt` | — |
| GET | `/v1/admin/me` | `staff:read` | `admin` | — | 200 `StaffMeResponse` | 401; 403 `auth.forbidden` / `auth.password_change_required`; 404 `http.not_found` |

### 2.7 Admin catalogue — RL `admin`, SO

**Categories** `/v1/admin/categories`

| Method | Path | Policy | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/v1/admin/categories` | `staff:read` | — | 200 `AdminCategoryResponse[]` (all, active or not; order `sort`, `nameAr`; `projectCount` counts projects in any status) | 401/403 |
| POST | `/v1/admin/categories` | `staff:catalogue` · C | `CategoryInput` (`version` ignored) | **201** `AdminCategoryResponse`, `Location: /v1/admin/categories/{id}` | 400 `validation.failed`; 409 `category.slug_taken`; 422 `media.image_required` (imageAssetId not a public image) |
| PUT | `/v1/admin/categories/order` | `staff:catalogue` · C | `CategoryOrderInput` `{ items: { id: guid, sort: 0–10000 }[] }` non-empty, each id once | 200 `AdminCategoryResponse[]` (full list) | 400; 404 `category.not_found` (any unknown id) |
| PUT | `/v1/admin/categories/{id:guid}` | `staff:catalogue` · C | `CategoryInput` with **`version` required** | 200 `AdminCategoryResponse` | 400 (`version is required.`); 404 `category.not_found`; 409 `concurrency.conflict`, `category.slug_taken`; 422 `media.image_required` |

`CategoryInput` validation: `slug` required, `^[a-z0-9-]{2,60}$`; `nameAr` required ≤120; `nameEn` ≤120; `descriptionAr`/`descriptionEn`
≤2000; `sort` 0–10000. `acceptsGeneralGifts`, `isActive` booleans (default false if omitted).

**Projects** `/v1/admin/projects` (incl. options)

| Method | Path | Policy | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/v1/admin/projects` | `staff:read` | query `status?` `draft\|published\|archived`; **`category?` = category id (GUID)** (not slug; invalid GUID → 400 binding); `q?` ≤100; `page`; `pageSize` | 200 `PagedResult<AdminProjectRow>` (order `updatedAt` desc; with `q`: search rank) | 400 |
| POST | `/v1/admin/projects` | `staff:catalogue` · C | `ProjectInput` (`version` ignored) — created as `draft` | **201** `AdminProjectResponse`, `Location: /v1/admin/projects/{id}` | 400; 404 `category.not_found` (undeclared); 409 `project.slug_taken` (also old slugs kept for redirects); 422 `media.image_required` |
| GET | `/v1/admin/projects/{id:guid}` | `staff:read` | — | 200 `AdminProjectResponse` (all options, old slugs, `missingForPublish`) | 404 `project.not_found` |
| PUT | `/v1/admin/projects/{id:guid}` | `staff:catalogue` · C | `ProjectInput` with **`version` required**. Slug change of a published project keeps the old slug for redirects | 200 `AdminProjectResponse` | 400; 404 `project.not_found` / `category.not_found`; 409 `concurrency.conflict`, `project.slug_taken`; 422 `media.image_required`, `project.publish_incomplete` (+`missing`; a published project must stay publishable) |
| PUT | `/v1/admin/projects/{id:guid}/options` | `staff:catalogue` · C | `ProjectOptionsInput` `{ options: ProjectOptionInputItem[] (≤50, unique trimmed `labelAr`, unique non-null ids), version: uint (required in practice) }`. Full replacement: `id: null` = new (or reuses an existing unclaimed option with the same `labelAr`); options removed from the list are deleted, or **deactivated** if used in an order | 200 `AdminProjectResponse` | 400 (`options`, `options[i].labelAr` 2–60, `labelEn` ≤60, `amount` positive money, `sort` 0–10000); 404 `project.not_found`; 409 `concurrency.conflict`; 422 `project.publish_incomplete` (`missing: ["amount"]` — published, no open amount, no active option); 422 `project.option_label_taken` (+`label`) |
| POST | `/v1/admin/projects/{id:guid}/publish` | `staff:catalogue` · C | no body | 200 `AdminProjectResponse` (draft/archived → published; `publishedAt` set once) | 404; 409 `project.invalid_transition` (+`from`,`to`; already published; undeclared); 422 `project.publish_incomplete` (+`missing`) |
| POST | `/v1/admin/projects/{id:guid}/archive` | `staff:catalogue` · C | no body | 200 `AdminProjectResponse` (published → archived) | 404; 409 `project.invalid_transition` (undeclared, declared 422) |
| GET | `/v1/admin/projects/{id:guid}/preview` | `staff:read` | — | 200 `ProjectDetail` (any status/category state; active options) | 404 `project.not_found` |

`ProjectInput` validation: `categoryId` non-empty GUID; `slug` `^[a-z0-9-]{2,80}$`; `titleAr` required 2–160; `titleEn` ≤160;
`summaryAr`/`summaryEn` ≤300; `bodyAr`/`bodyEn` ≤20000 (Markdown); `minAmount` null or positive money; `badge` null\|`new`\|`urgent`;
`sort` 0–10000; `seoTitleAr`/`seoTitleEn` ≤160; `seoDescAr`/`seoDescEn` ≤300; `coverAssetId` must be a public image; `allowOpenAmount` bool.

**Media** `/v1/admin/media`

| Method | Path | Policy | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/v1/admin/media` | `staff:catalogue` (antiforgery disabled, request limit 21 MiB) | `multipart/form-data`: `file` (required), `kind` (required, `image\|pdf`), `altAr?` ≤300 (**required for images**), `altEn?` ≤300. Type sniffed by magic bytes: images JPEG/PNG/WebP ≤10 MiB and ≤40 MP → re-encoded WebP, longest edge ≤2400 px, metadata dropped; PDF (`%PDF-`) ≤20 MiB. SVG/others refused. All uploads are public | **201** `MediaAssetResponse`, `Location: /v1/admin/media/{id}` | 400 `validation.failed` (`kind`, `length` = "file is required.", `altAr`, `altEn`; missing `file`/`kind` form field → 400 binding without `errors`); 413 `media.too_large` (+`max`: 10485760 / 20971520 bytes, or 40000000 pixels); 413 `http.error` (body >21 MiB at Kestrel); 415 `media.type_not_allowed`; 422 `media.alt_required` |
| GET | `/v1/admin/media` | `staff:read` | `kind?` (`image\|pdf`, unknown ignored), `page`, `pageSize` (clamped, no 400) | 200 `PagedResult<MediaAssetResponse>` (newest first) | — |
| PATCH | `/v1/admin/media/{id:guid}` | `staff:catalogue` · C | `MediaAltInput` `{ altAr?: ≤300, altEn?: ≤300 }` — **replaces both** (`altEn` null/blank clears it) | 200 `MediaAssetResponse` | 400; 404 `http.not_found`; 422 `media.alt_required` (image with blank `altAr`) |

### 2.8 Admin operations — RL `admin`, SO

| Method | Path | Policy | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/v1/admin/dashboard` | `staff:read` | — | 200 `DashboardResponse` (top 5 projects by pending amount) | 401/403 |
| GET | `/v1/admin/customers` | `staff:read` | `q?` ≤100 (a Saudi mobile in any accepted form → exact mobile match; otherwise case-insensitive substring of name or e-mail); `status?` `active\|blocked\|anonymised`; `page`; `pageSize` | 200 `PagedResult<AdminCustomerRow>` (newest first) | 400 |
| GET | `/v1/admin/customers/{id:guid}` | `staff:read` | — | 200 `AdminCustomerDetail` (last 20 orders; anonymised donors are returned) | 404 `http.not_found` |
| POST | `/v1/admin/customers/{id:guid}/block` | `staff:customers` | no body | 204 (sessions revoked; audited `customer.blocked`) | 404 `http.not_found` (also anonymised) |
| POST | `/v1/admin/customers/{id:guid}/unblock` | `staff:customers` | no body | 204 (audited) | 404 `http.not_found` |
| GET | `/v1/admin/orders` | `staff:read` | `reference?` ≤20 (trimmed, upper-cased, exact); `mobile?` ≤20 (normalised to E.164 if valid, else raw exact); `status?` order status wire value; `from?`/`to?` `YYYY-MM-DD` Riyadh, inclusive, `from ≤ to`; `page`; `pageSize` | 200 `PagedResult<AdminOrderRow>` (newest first) | 400 (`reference`, `mobile`, `status` "Unknown order status.", `to`, `page`, `pageSize`) |
| GET | `/v1/admin/orders/{reference}` | `staff:read` | path (case-insensitive: upper-cased) | 200 `AdminOrderDetail` | 404 `order.not_found` |
| POST | `/v1/admin/orders/{reference}/cancel` | `staff:orders` | no body | 200 `AdminOrderRow` (status `cancelled`, `cancelledBy` = staff e-mail; audited; `OrderCancelled` queued) | 404 `order.not_found`; 409 `order.cancel_not_allowed` (only `pending_payment`; extension `status`) |
| GET | `/v1/admin/settings` | `staff:admin` | — | 200 `SettingResponse[]` (stored rows, by key; money keys always strings) | 401/403 |
| PUT | `/v1/admin/settings/{key}` | `staff:admin` · C | `SettingInput` `{ value: <JSON> }` — typed per key (table below) | 200 `SettingResponse` (canonical value; settings cache invalidated) | 404 `setting.unknown_key`; 422 `setting.invalid_value` (wrong type/range, or breaks `min_gift ≤ max_line ≤ cart_max_total` / presets ≥ min_gift) |
| GET | `/v1/admin/templates` | `staff:templates` | — | 200 `TemplateResponse[]` (by key, channel, locale) | 401/403 |
| POST | `/v1/admin/templates/test` | `staff:templates` + RL `template-test` (5/h/staff) | `TemplateTestRequest` `{ channel: "sms"\|"email", subject?: ≤300, body: required ≤10000, to?: Saudi mobile (required when sms) }`. Rendered (Scriban) with sample values `code=123456, subject=Test, body=Test message, reference=T3-26-000001, amount=50.00, name=Test`; e-mail goes to the caller's own e-mail; nothing stored | 200 `TemplateTestResponse` | 400; 422 `template.render_failed` (+`line`, `column`); 429 `http.rate_limited` |
| PUT | `/v1/admin/templates/{key}/{channel}/{locale}` | `staff:templates` | `TemplateInput` `{ subject?: ≤300 (ignored/cleared for sms), body: required ≤10000 }`; text must parse | 200 `TemplateResponse` | 400; 404 `http.not_found` (unknown channel or template); 422 `template.render_failed` (+`line`,`column`) |
| GET | `/v1/admin/audit` | `staff:admin` | `actor?`, `action?`, `entity?`, `entityId?` (exact matches); `page`; `pageSize` (default **50**) | 200 `PagedResult<AuditRow>` (newest first, by id) | 400 |

Seeded templates: `otp/sms/ar`, `otp/sms/en`, `staff_alert/email/ar`, `staff_alert/email/en`.

Settings allow-list (`PUT /v1/admin/settings/{key}`):

| Key | Type of `value` | Rule | Seed |
|---|---|---|---|
| `min_gift_amount` | money string | >0, ≤ `"100000.00"` | `"10.00"` |
| `max_line_amount` | money string | >0, ≤100000.00 | `"100000.00"` |
| `cart_max_total` | money string | >0, ≤100000.00 | `"100000.00"` |
| `cart_max_lines` | integer | 1–50 | 50 |
| `payment_window_minutes` | integer | 5–1440 | 60 |
| `amount_presets` | money string[] | 1–6 items, each valid money >0 ≤100000, each ≥ `min_gift_amount` | `["50.00","100.00","500.00"]` |
| `site_name_ar` / `site_name_en` | string 1–120 or `null` | — | `"متجر تعلّم"` / `"ta3lom store"` |
| `support_mobile` | `null` or `"+9665XXXXXXXX"` | regex `^\+9665[0-9]{8}$` | `null` |

Consistency (checked against committed values under a lock): `min_gift_amount ≤ max_line_amount ≤ cart_max_total`, all presets ≥ min gift.

### 2.9 Admin staff — `/v1/admin/staff`, policy `staff:admin`, RL `admin`, SO

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/v1/admin/staff` | — | 200 `StaffUserResponse[]` (by e-mail) | 401/403 |
| POST | `/v1/admin/staff` | `CreateStaffRequest` `{ email: email ≤254, name: required ≤120, roles: non-empty, each a valid role }` | **201** `CreateStaffResponse` (`oneTimePassword` shown once; must change at first sign-in, TOTP enrolment forced), `Location: /v1/admin/staff/{id}` | 400 (`email`, `name`, `roles`, `roles[i]` "Unknown role."); 409 `staff.email_taken` |
| PUT | `/v1/admin/staff/{id:guid}` | `UpdateStaffRequest` `{ name: required ≤120, roles: non-empty valid, isActive: boolean, version: uint }` | 200 `StaffUserResponse` (deactivation revokes sessions) | 400; 404 `http.not_found`; 409 `concurrency.conflict`; 409 `staff.last_admin` |
| POST | `/v1/admin/staff/{id:guid}/reset-password` | no body | 200 `OneTimePasswordResponse` (sessions revoked; must change at next sign-in) | 404 `http.not_found` |
| POST | `/v1/admin/staff/{id:guid}/reset-totp` | no body | 204 (next sign-in enrols again; sessions revoked) | 404 |
| POST | `/v1/admin/staff/{id:guid}/unlock` | no body | 204 (lockout and failure count cleared) | 404 |

### 2.10 Health (unversioned, anonymous, no CORS, no rate limit)

| Method | Path | Response |
|---|---|---|
| GET | `/health/live` | 200 `{ "status": "Healthy" }` (no dependency checks) |
| GET | `/health/ready` | `{ status, totalDurationMs: number, checks: { name: "postgres"\|"outbox", status, durationMs: number, data?: object }[] }`. Healthy/Degraded → **200**, Unhealthy → **503**. `outbox.data` = `{ deadLettered24h: number, overdue: number }` (Degraded when either > 0). Never contains exception text |

### 2.11 Dev (Development environment only; `/dev`, anonymous, no CORS, no origin check, excluded from OpenAPI)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/dev/sms` | `count` 1–200 (default 50, clamped) | 200 `DevSmsMessage[]` `{ sentAt, to, body }` newest first (OTP codes visible here) |
| GET | `/dev/mail` | `count` 1–200 (default 20) | 200 `DevMailMessage[]` `{ sentAt, to, subject, body, attachments: string[], file }` |
| GET | `/dev/jobs` | — | 200 `{ [jobName]: cron }` — keys `PruneOtpJob`, `PruneIdempotencyKeysJob`, `ExpireGuestCartsJob`, `RetentionJob`, `IntegrityChecksJob` |
| POST | `/dev/jobs/{name}` | path = job name | 202 (no body) / 404 |
| GET | `/openapi/v1.json`, `/docs` | — | OpenAPI document / Scalar UI |

---

## 3. DTOs (exact JSON names)

```ts
type Guid = string;            // UUID
type Money = string;           // "50.00"
type Instant = string;         // ISO 8601 with offset
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

// ── Catalogue (public) ───────────────────────────────────────────────────────────────
interface CategorySummary {
  id: Guid; slug: string; nameAr: string; nameEn: string | null;
  descriptionAr: string | null; descriptionEn: string | null;
  imageUrl: string | null; imageAltAr: string | null;
  acceptsGeneralGifts: boolean;
  projectCount: number;                 // published projects in it
}
interface ProjectCard {
  id: Guid; slug: string; titleAr: string; titleEn: string | null;
  summaryAr: string | null; summaryEn: string | null;
  coverUrl: string | null; coverAltAr: string | null;
  badge: "new" | "urgent" | null;
  categorySlug: string;
  allowOpenAmount: boolean;
  minAmount: Money;                     // effective open-amount minimum (project minAmount ?? min_gift_amount)
  fromAmount: Money | null;             // lowest active option amount, null if no active option
}
interface ProjectOptionView { id: Guid; labelAr: string; labelEn: string | null; amount: Money }
interface CategoryRef { id: Guid; slug: string; nameAr: string; nameEn: string | null }
interface ProjectDetail {
  id: Guid; slug: string; status: "draft" | "published" | "archived";
  titleAr: string; titleEn: string | null; summaryAr: string | null; summaryEn: string | null;
  bodyAr: string | null; bodyEn: string | null;            // Markdown
  coverUrl: string | null; coverAltAr: string | null; coverAltEn: string | null;
  badge: "new" | "urgent" | null;
  category: CategoryRef;
  allowOpenAmount: boolean; minAmount: Money;
  options: ProjectOptionView[];                            // active only, by sort
  seoTitleAr: string | null; seoTitleEn: string | null; seoDescAr: string | null; seoDescEn: string | null;
  publishedAt: Instant | null;
}
interface SlugRedirectResponse { redirectTo: string }      // current slug
interface ProjectSlugsResponse { slugs: string[] }
interface HomeResponse { featured: ProjectCard[]; categories: CategorySummary[]; amountPresets: Money[] }
interface CatalogConfigResponse {
  minGiftAmount: Money; maxLineAmount: Money; cartMaxLines: number; cartMaxTotal: Money;
  maxQuantity: number;                  // 999
  amountPresets: Money[];
}

// ── Admin catalogue ──────────────────────────────────────────────────────────────────
interface CategoryInput {
  slug: string; nameAr: string; nameEn?: string | null; descriptionAr?: string | null; descriptionEn?: string | null;
  imageAssetId?: Guid | null; acceptsGeneralGifts: boolean; sort: number; isActive: boolean;
  version?: number | null;              // required on PUT
}
interface AdminCategoryResponse {
  id: Guid; slug: string; nameAr: string; nameEn: string | null; descriptionAr: string | null; descriptionEn: string | null;
  imageAssetId: Guid | null; imageUrl: string | null; acceptsGeneralGifts: boolean; sort: number; isActive: boolean;
  projectCount: number;                 // all statuses
  updatedAt: Instant; version: number;
}
interface CategoryOrderInput { items: CategoryOrderItem[] }
interface CategoryOrderItem { id: Guid; sort: number }
interface ProjectInput {
  categoryId: Guid; slug: string; titleAr: string; titleEn?: string | null;
  summaryAr?: string | null; summaryEn?: string | null; bodyAr?: string | null; bodyEn?: string | null;
  coverAssetId?: Guid | null; allowOpenAmount: boolean; minAmount?: Money | null; badge?: "new" | "urgent" | null; sort: number;
  seoTitleAr?: string | null; seoTitleEn?: string | null; seoDescAr?: string | null; seoDescEn?: string | null;
  version?: number | null;              // required on PUT
}
interface ProjectOptionsInput { options: ProjectOptionInputItem[]; version: number }
interface ProjectOptionInputItem { id?: Guid | null; labelAr: string; labelEn?: string | null; amount: Money; sort: number; isActive: boolean }
interface AdminProjectRow {
  id: Guid; slug: string; status: "draft" | "published" | "archived"; titleAr: string;
  categoryId: Guid; categoryNameAr: string; sort: number; activeOptionCount: number; allowOpenAmount: boolean;
  publishedAt: Instant | null; updatedAt: Instant;
}
interface AdminProjectOption { id: Guid; labelAr: string; labelEn: string | null; amount: Money; sort: number; isActive: boolean }
interface AdminProjectResponse {
  id: Guid; categoryId: Guid; slug: string; status: "draft" | "published" | "archived";
  titleAr: string; titleEn: string | null; summaryAr: string | null; summaryEn: string | null; bodyAr: string | null; bodyEn: string | null;
  coverAssetId: Guid | null; coverUrl: string | null; allowOpenAmount: boolean;
  minAmount: Money | null;              // raw project value (not the effective minimum)
  badge: "new" | "urgent" | null; sort: number;
  seoTitleAr: string | null; seoTitleEn: string | null; seoDescAr: string | null; seoDescEn: string | null;
  options: AdminProjectOption[];        // all, active or not, by sort
  oldSlugs: string[];                   // by change time
  missingForPublish: ("titleAr" | "summaryAr" | "bodyAr" | "cover" | "category" | "amount")[];
  publishedAt: Instant | null; createdAt: Instant; updatedAt: Instant; version: number;
}

// ── Media ────────────────────────────────────────────────────────────────────────────
interface MediaAssetResponse {
  id: Guid; kind: "image" | "pdf"; isPublic: boolean; url: string | null;   // url only when public
  mime: string;                         // "image/webp" | "application/pdf"
  sizeBytes: number; width: number | null; height: number | null;
  altAr: string | null; altEn: string | null; createdAt: Instant;
}
interface MediaAltInput { altAr?: string | null; altEn?: string | null }
// Upload form fields: file (binary), kind ("image"|"pdf"), altAr?, altEn?

// ── Settings ─────────────────────────────────────────────────────────────────────────
interface SettingResponse { key: string; value: unknown /* JSON */; updatedAt: Instant; updatedBy: string | null }
interface SettingInput { value: unknown /* JSON */ }

// ── Donor auth ───────────────────────────────────────────────────────────────────────
interface RequestOtpRequest { mobile: string; locale?: "ar" | "en" | null }
interface OtpRequestedResponse { expiresInSeconds: number }            // 300
interface VerifyOtpRequest { mobile: string; code: string }
interface SessionResponse {
  accessToken: string; expiresIn: number;                               // 900
  customer: CustomerSessionResponse;
  cartNotices: CartNoticeResponse[];
}
interface CustomerSessionResponse {
  id: Guid; mobile: string;             // E.164 "+9665XXXXXXXX", unmasked
  fullName: string | null; email: string | null; locale: "ar" | "en";
  isNew: boolean; profileComplete: boolean;                             // name and e-mail both set
}
interface CartNoticeResponse { code: "cart.merge_combined" | "cart.merge_dropped"; lineId: Guid | null }
  // combined: lineId = the donor line that absorbed it; dropped: lineId = the (now deleted) guest line id
interface AccessTokenResponse { accessToken: string; expiresIn: number }

// ── Cart / checkout / orders ─────────────────────────────────────────────────────────
interface CartLineResponse {
  id: Guid; targetKind: "project" | "category";
  projectId: Guid | null; projectSlug: string | null; categoryId: Guid | null; categorySlug: string | null;
  optionId: Guid | null;
  titleAr: string;                      // "—" when the target no longer exists
  titleEn: string | null; optionLabelAr: string | null; optionLabelEn: string | null;
  quantity: number;                     // 1 for amount lines
  unitAmount: Money; amount: Money;     // amount = unit × quantity (indicative, current catalogue price)
  problems: string[];                   // line problem codes (1.9)
}
interface CartProblemResponse { lineId: Guid | null; code: string }
interface CartResponse { lines: CartLineResponse[]; lineCount: number; totalAmount: Money; problems: CartProblemResponse[] }
interface CartSummaryResponse { lineCount: number; totalAmount: Money }
interface AddCartLineRequest { projectId?: Guid | null; optionId?: Guid | null; quantity?: number | null; categoryId?: Guid | null; amount?: Money | null }
interface UpdateCartLineRequest { quantity?: number | null; amount?: Money | null }
interface CheckoutRequest { fullName?: string | null; email?: string | null; locale?: "ar" | "en" | null }
interface CheckoutResponse {
  reference: string;                    // "T3-26-000001"
  status: "pending_payment";
  totalAmount: Money;
  statusToken: string;                  // base64url HMAC of the reference; use as ?t= on /v1/orders/{reference}/status
  payment: CheckoutPayment | null;      // always null in this release
}
interface CheckoutPayment { redirectUrl: string }
interface OrderStatusResponse { reference: string; status: string; totalAmount: Money; lineCount: number; createdAt: Instant; paymentDueAt: Instant }

// ── Me ───────────────────────────────────────────────────────────────────────────────
interface MeResponse {
  id: Guid; mobile: string | null; fullName: string | null; email: string | null; locale: "ar" | "en";
  marketingOptIn: boolean; status: "active" | "blocked" | "anonymised"; pdplConsentAt: Instant | null; createdAt: Instant;
}
interface UpdateMeRequest { fullName?: string | null; email?: string | null; locale?: "ar" | "en" | null; marketingOptIn?: boolean | null }
interface DonationSummary { reference: string; status: string; totalAmount: Money; lineCount: number; createdAt: Instant }
interface DonationLineResponse {
  lineNo: number; targetKind: "project" | "category"; projectId: Guid | null; categoryId: Guid | null;
  titleAr: string; titleEn: string | null; optionLabelAr: string | null; optionLabelEn: string | null;
  quantity: number; unitAmount: Money; amount: Money;
}
interface DonationDetail {
  reference: string; status: string; totalAmount: Money; donorName: string; donorEmail: string;
  createdAt: Instant; paymentDueAt: Instant; cancelledAt: Instant | null; lines: DonationLineResponse[];
}
interface MeExportResponse { profile: MeResponse; donations: DonationDetail[]; exportedAt: Instant }

// ── Staff auth / staff ───────────────────────────────────────────────────────────────
interface StaffLoginRequest { email: string; password: string }
interface StaffLoginResponse { mfaToken: string; totpEnrolled: boolean }
interface TotpEnrolResponse { otpauthUri: string; secretBase32: string }
interface TotpVerifyRequest { code: string }
interface StaffSessionResponse { accessToken: string; expiresIn: number /* 600 */; staff: StaffMeResponse }
interface ChangePasswordRequest { currentPassword: string; newPassword: string }
interface StaffMeResponse { id: Guid; email: string; name: string; roles: string[]; mustChangePassword: boolean; lastLoginAt: Instant | null }
interface StaffUserResponse {
  id: Guid; email: string; name: string; roles: string[]; isActive: boolean; totpEnrolled: boolean;
  mustChangePassword: boolean; lockedUntil: Instant | null; lastLoginAt: Instant | null; createdAt: Instant; version: number;
}
interface CreateStaffRequest { email: string; name: string; roles: string[] }
interface CreateStaffResponse { staff: StaffUserResponse; oneTimePassword: string }
interface UpdateStaffRequest { name: string; roles: string[]; isActive: boolean; version: number }
interface OneTimePasswordResponse { oneTimePassword: string }

// ── Admin ops ────────────────────────────────────────────────────────────────────────
interface DashboardResponse {
  publishedProjects: number; activeCategories: number; activeDonors: number;
  pendingOrdersToday: number; pendingOrdersThisWeek: number;
  topProjectsByPendingAmount: DashboardProject[];        // ≤5
}
interface DashboardProject { projectId: Guid; slug: string; titleAr: string; pendingOrders: number; pendingAmount: Money }
interface AdminCustomerRow {
  id: Guid; mobile: string | null /* E.164, unmasked */; fullName: string | null; email: string | null;
  status: "active" | "blocked" | "anonymised"; orderCount: number; createdAt: Instant; lastLoginAt: Instant | null;
}
interface AdminCustomerDetail {
  id: Guid; mobile: string | null; fullName: string | null; email: string | null; locale: "ar" | "en"; marketingOptIn: boolean;
  status: "active" | "blocked" | "anonymised"; pdplConsentAt: Instant | null; createdAt: Instant; lastLoginAt: Instant | null;
  recentOrders: AdminOrderRow[];        // ≤20, newest first
  version: number;
}
interface AdminOrderRow {
  reference: string; status: string; totalAmount: Money; lineCount: number; donorName: string; donorMobile: string;
  createdAt: Instant; paymentDueAt: Instant;
}
interface AdminOrderLine {
  lineNo: number; targetKind: "project" | "category"; projectId: Guid | null; categoryId: Guid | null; optionId: Guid | null;
  titleAr: string; titleEn: string | null; optionLabelAr: string | null;            // NB: no optionLabelEn here
  quantity: number; unitAmount: Money; amount: Money;
}
interface AdminOrderDetail {
  reference: string; status: string; totalAmount: Money; customerId: Guid; donorName: string; donorEmail: string; donorMobile: string;
  locale: "ar" | "en"; createdAt: Instant; paymentDueAt: Instant; cancelledAt: Instant | null; cancelledBy: string | null;
  lines: AdminOrderLine[];
}
interface TemplateResponse { key: string; channel: "sms" | "email"; locale: string; subject: string | null; body: string; updatedAt: Instant; updatedBy: string | null }
interface TemplateInput { subject?: string | null; body: string }
interface TemplateTestRequest { channel: "sms" | "email"; subject?: string | null; body: string; to?: string | null }
interface TemplateTestResponse { subject: string | null; body: string; sent: boolean }
interface AuditRow { id: number; at: Instant; actor: string; action: string; entity: string; entityId: string | null; diff: string | null /* JSON text */ }

// ── Health / dev ─────────────────────────────────────────────────────────────────────
interface HealthLive { status: "Healthy" }
interface HealthReady { status: "Healthy" | "Degraded" | "Unhealthy"; totalDurationMs: number; checks: { name: string; status: string; durationMs: number; data?: Record<string, unknown> }[] }
interface DevSmsMessage { sentAt: Instant; to: string; body: string }
interface DevMailMessage { sentAt: Instant; to: string; subject: string; body: string; attachments: string[]; file: string }
```

Anonymised donor/order values: `donorName "—"`, `donorEmail "deleted@invalid"`, `donorMobile "deleted"`.
Mobile input accepts `05XXXXXXXX`, `5XXXXXXXX`, `9665XXXXXXXX`, `+9665XXXXXXXX`, `009665XXXXXXXX` (spaces/dashes ignored); stored/returned
as E.164 `+9665XXXXXXXX`.

---

## 4. Error codes

`ErrorCodes.cs` (all have ar/en messages in `ErrorMessages*.resx`).

| Code | HTTP | Where / extra members |
|---|---|---|
| `validation.failed` | 400 | validators (`errors`), unbindable body/query (no `errors`), `Idempotency-Key` length |
| `http.not_found` | 404 | unmatched route (status pages); `GeneralErrors.NotFound` (me, export, customers, media, templates); `StaffErrors.NotFound` (staff, admin/me) |
| `http.rate_limited` | 429 | rate limiter (+ `Retry-After` header) |
| `http.origin_forbidden` | 403 | origin check |
| `http.error` | other 4xx | 405, 413 (Kestrel/form limit), 415, any status without a mapping |
| `server.error` | 500 / ≥500 | unhandled exception |
| `concurrency.conflict` | 409 | stale `version` (categories, projects, options, staff) or EF concurrency exception |
| `db.duplicate` | 409 | PostgreSQL unique violation race |
| `db.reference_missing` | 422 | PostgreSQL FK violation race |
| `auth.unauthenticated` | 401 | default 401; inactive staff on password change |
| `auth.forbidden` | 403 | default 403 (role/scheme) |
| `auth.account_blocked` | 403 | OTP verify, refresh, cart writes, checkout, PATCH/DELETE `/me` |
| `auth.refresh_invalid` | 401 | donor + staff refresh |
| `auth.refresh_expired` | 401 | refresh |
| `auth.refresh_reused` | 401 | refresh (family revoked, audited) |
| `auth.refresh_race` | 409 | refresh within 20 s grace (cookie kept) |
| `otp.mobile_invalid` | 400 | OTP request/verify |
| `otp.rate_limited` | 429 | OTP request; `retryAfterSeconds` + `Retry-After` |
| `otp.invalid` | 400 | OTP verify; `attemptsLeft` |
| `otp.expired` | 400 | OTP verify |
| `otp.too_many_attempts` | 429 | OTP verify (5 wrong; no Retry-After) |
| `auth.invalid_credentials` | 401 | staff login (wrong/unknown/inactive/locked) |
| `auth.account_locked` | 423 | totp enrol/verify, password change; `lockedUntil` |
| `auth.totp_required` | 401 | totp enrol/verify (inactive user, spent MFA token) |
| `auth.totp_invalid` | 401 | totp verify |
| `auth.totp_not_enrolled` | 401 | totp verify |
| `auth.totp_unavailable` | 503 | totp verify (secret undecryptable) |
| `auth.totp_already_enrolled` | 409 | totp enrol |
| `auth.password_change_required` | 403 | any `staff:*` route with `pwd_change=true` |
| `auth.password_weak` | 422 | password change; `reasons` |
| `auth.current_password_invalid` | 422 | password change |
| `staff.email_taken` | 409 | create staff |
| `staff.last_admin` | 409 | update staff |
| `media.alt_required` | 422 | upload / PATCH media |
| `media.type_not_allowed` | 415 | upload |
| `media.too_large` | 413 | upload; `max` (int) |
| `setting.unknown_key` | 404 | PUT setting |
| `setting.invalid_value` | 422 | PUT setting |
| `category.not_found` | 404 | admin categories; project create/update (bad `categoryId`) |
| `category.slug_taken` | 409 | category create/update |
| `project.not_found` | 404 | admin projects; public `GET /catalog/projects/{slug}` |
| `project.slug_taken` | 409 | project create/update |
| `project.publish_incomplete` | 422 | publish, update of a published project, options of a published project; `missing` |
| `project.invalid_transition` | 409 | publish/archive; `from`, `to` |
| `project.option_label_taken` | 422 | options replace; `label` |
| `media.image_required` | 422 | category `imageAssetId` / project `coverAssetId` not a public image |
| `cart.target_unavailable` | 422 | add line (also a line problem code) |
| `cart.option_unavailable` | 422 | add line |
| `cart.open_amount_not_allowed` | 422 | add line |
| `cart.amount_below_minimum` | 422 | add/update line; `min` (money) |
| `cart.amount_above_maximum` | 422 | add/update line; `max` (money) |
| `cart.quantity_limit` | 422 | add/update line; `max` = 999 |
| `cart.too_many_lines` | 422 | add line; `max` (int) |
| `cart.total_exceeded` | 422 | add/update line; `max` (money) |
| `cart.line_not_found` | 404 | update/remove line |
| `checkout.cart_empty` | 409 | quote, checkout |
| `checkout.lines_invalid` | 422 | checkout; `problems[]` |
| `checkout.contact_required` | 422 | checkout |
| `order.not_found` | 404 | order status, my donation, admin order, cancel |
| `order.cancel_not_allowed` | 409 | cancel; extension `status` (order status) |
| `idempotency.key_required` | 400 | checkout |
| `idempotency.key_reused` | 422 | checkout |
| `idempotency.in_progress` | 409 | checkout |
| `template.render_failed` | 422 | template update/test; `line`, `column` |

Non-catalogue codes that can surface as **409** via `DomainException` (invariant guards; normally pre-empted by validation):
`project.option_label_duplicate`, `project.option_id_duplicate`, `customer.not_active`, `customer.anonymised`, `customer.locale_invalid`,
`media.alt_required` (guard copy), `money.precision`, `money.overflow`, `cart.merge_invalid`, `domain.error`, and others in
`Guard.Against(...)` (`project.slug_invalid`, `project.title_length`, `staff.role_invalid`, …). These have no resx message (title falls
back to the exception message/default).

Cart merge notice codes (`cart.merge_combined`, `cart.merge_dropped`) appear only in `SessionResponse.cartNotices`, never as problems.

---

## 5. Surprises / gaps worth knowing

1. **`order.cancel_not_allowed` puts the order status in a problem extension named `status`**, which collides with the RFC `status` member;
   with ASP.NET's ProblemDetails serializer the extension is written as an additional `"status"` key → the JSON can contain `status` twice
   (409 and `"pending_payment"`/`"cancelled"`), and most parsers keep the last one. Clients should not rely on either.
2. `GET /v1/admin/me` is blocked (403 `auth.password_change_required`) during a forced password change.
3. Declared-but-unreachable/undeclared statuses: staff login never returns 423 (locked → 401 by design); `/totp/enrol` can return 423 and
   `/totp/verify` 503, `/admin/projects` POST/PUT 404 `category.not_found`, publish 409, archive 409 — none declared in `.Produces`.
4. `GET /v1/orders/{reference}/status` and `GET /v1/me/donations/{reference}` match the reference **case-sensitively**; the admin order
   routes upper-case it.
5. `PUT /v1/admin/projects/{id}/options` with `options` missing/null, or an option with `labelAr: null`, makes the validator's `Must`
   lambdas dereference null → likely **500** instead of 400 (no `CascadeMode.Stop`). Same pattern is safe elsewhere.
6. Rate policy `download` and `CachedLive()` exist but nothing uses them; `/v1/downloads` is in the no-store list but has no routes.
7. Production CORS/origin list also allows `https://store-staging.ta3lom.sa` (staging is not overridden in `appsettings.Staging.json` and
   prod uses the base list).
8. `t3s_cart` is not rewritten on reads or `DELETE /v1/cart`, only on guest line writes.
9. Media list has no paging validator (clamps silently); `kind` filter ignores unknown values.
10. `CartSummaryResponse.totalAmount` uses stored line amounts, while `CartResponse.totalAmount` is re-priced from the catalogue — they can
    differ.
11. Validation messages are English only; `title`/`detail` are localized.
