# PHASE 03 — Merchant Authentication & Tenant Security Layer

## 1. Purpose
Implement merchant onboarding, secure Razorpay API Key Secret encryption at rest using AES-256-GCM, JWT session authentication, password hashing, and NestJS `TenantGuard` to enforce multi-tenant isolation (`WHERE merchant_id = :merchantId`).

Isolating data access by `merchantId` and encrypting Razorpay API secrets at rest prior to processing webhooks or dispatching recovery actions ensures compliance with security guidelines (NFR-SEC-001, NFR-SEC-005).

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 6 (*FR-001 Merchant Onboarding* & *FR-002 Merchant Profile*): Merchant account creation, credential configuration, and policy setup.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 2 (*NFR-SEC-001 Credential Storage Encryption*): Mandatory AES-256-GCM encryption for Razorpay API key secrets at rest.
  * Section 2 (*NFR-SEC-002 API Authentication* & *NFR-SEC-005 Multi-Tenant Isolation*): JWT authentication and strict tenant data isolation.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 11.1 (*Merchant Authentication & Tenant Isolation Models*): `Merchant`, `MerchantCredential`, and `UserSession` schemas and AES-256-GCM encryption requirements.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 11 (*Security Validation*) & HIGH-05: Merchant authentication, secret protection, and tenant isolation boundaries.

---

## 3. Prerequisites / Dependencies
* **PHASE-01 (Foundation)**: Requires application framework, environment configuration, and `pnpm` package manager.
* **PHASE-02 (Database)**: Requires `Merchant`, `MerchantCredential`, and `UserSession` database tables.

---

## 4. Scope
* Implement AES-256-GCM encryption service for Razorpay `keySecret` storage.
* Implement merchant registration (`POST /api/v1/auth/register`) and login (`POST /api/v1/auth/login`).
* Implement JWT strategy, passport auth guards, and `@CurrentMerchant()` parameter decorator.
* Implement Razorpay API credential configuration endpoint (`PUT /api/v1/merchant/credentials`).
* Implement `TenantGuard` ensuring all merchant requests populate `req.merchantId` and database queries enforce `WHERE merchant_id = :merchantId`.

---

## 5. Technical Implementation Requirements
1. **AES-256-GCM Encryption Service**:
   * Create `CryptoService` using Node.js `crypto` module.
   * Encrypt plaintext Razorpay key secret using `aes-256-gcm` with a 96-bit random IV and 128-bit authentication tag.
   * Format stored ciphertext as `iv:authTag:encryptedData`.
   * Add decryption method returning plaintext secret for background Razorpay API requests.
2. **Merchant Authentication**:
   * Add dependencies via `pnpm`: `pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt` and `@types/bcrypt`.
   * Implement `AuthService`:
     - Merchant signup with bcrypt password hashing (12 rounds).
     - Merchant login returning signed JWT access token containing `{ sub: merchantId, email }`.
3. **Razorpay Credential Management**:
   * Implement `MerchantService`:
     - Endpoint `PUT /api/v1/merchant/credentials` accepting `keyId`, `keySecret`, and `webhookSecret`.
     - Validates credential format (`rzp_test_...` or `rzp_live_...`).
     - Encrypts `keySecret` via `CryptoService` before storing in `MerchantCredential` table.
     - **Strict Prohibition**: Plaintext secrets MUST NEVER be returned in API responses.
4. **Tenant Isolation Guard**:
   * Create `TenantGuard` extracting `merchantId` from JWT payload.
   * Attaches `merchantId` to HTTP request (`req.merchantId`).
   * Create custom decorator `@CurrentMerchant()` for NestJS controllers.

---

## 6. Files / Modules / Components Affected
```text
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── crypto/
│   │   └── crypto.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── tenant.guard.ts
│   └── strategies/
│       └── jwt.strategy.ts
└── merchant/
    ├── merchant.module.ts
    ├── merchant.controller.ts
    └── merchant.service.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **API Endpoints**:
  * `POST /api/v1/auth/register` (body: `email`, `password`, `businessName`).
  * `POST /api/v1/auth/login` (body: `email`, `password` $\rightarrow$ returns `{ accessToken }`).
  * `PUT /api/v1/merchant/credentials` (Auth Header: `Bearer <token>`, body: `keyId`, `keySecret`, `webhookSecret`).
* **Database Updates**: Populates `merchants`, `merchant_credentials`, and `user_sessions`.

---

## 8. Acceptance Criteria
* Registering a new merchant creates a `Merchant` record and returns a valid JWT.
* Login with incorrect password returns `HTTP 401 Unauthorized`.
* Invoking `PUT /api/v1/merchant/credentials` stores `keySecret` in `merchant_credentials` as an AES-256-GCM encrypted string.
* Inspecting database directly confirms `key_secret` is NOT stored in plaintext.
* Requesting authenticated merchant routes without a valid Bearer token returns `HTTP 401 Unauthorized`.
* All database queries triggered under a merchant session explicitly include `WHERE merchant_id = :merchantId`.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * AES-256-GCM encryption/decryption roundtrip accuracy.
  * Bcrypt password hashing and verification.
  * JWT issuance and signature validation.
  * Secret redaction in API responses (`keySecret` must never be returned).
  * `TenantGuard` query scoping enforcement.
* **Verification Scope**: Unit tests for crypto and auth services; integration HTTP tests for register, login, and credential configuration endpoints.

---

## 10. Definition of Done
* Merchant signup, login, AES-256-GCM secret encryption, JWT authentication, and tenant isolation guards operational with passing unit/integration tests executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* OAuth2 or third-party Identity Provider (IdP) integration.
* Webhook HMAC signature verification (handled in Phase 04).
* Dynamic Payment Link execution against Razorpay API (handled in Phase 09).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
