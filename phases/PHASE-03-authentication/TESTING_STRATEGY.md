# Phase 03 Testing Strategy — Merchant Authentication & Tenant Security Layer

## 1. Overview
This testing strategy covers unit, integration, and E2E verification for merchant onboarding, bcrypt password hashing, stateless JWT authentication, AES-256-GCM credential encryption at rest, tenant isolation guards, and cross-tenant security boundaries.

## 2. Test Suites & Coverage

### Unit Test Suite (`apps/backend/src/`)
- **Execution Command**: `pnpm --filter backend test`
- **Coverage**:
  1. **`CryptoService` (`crypto.service.spec.ts`)**:
     - AES-256-GCM encryption/decryption roundtrip.
     - IV randomness verification across identical plaintexts.
     - Authentication tag tamper detection.
  2. **`AuthService` (`auth.service.spec.ts`)**:
     - Password hashing with bcrypt (12 rounds).
     - Registration duplicate email detection (`HTTP 409 Conflict`).
     - Login invalid password rejection (`HTTP 401 Unauthorized`).
     - JWT access token generation.
  3. **`MerchantService` (`merchant.service.spec.ts`)**:
     - AES-256-GCM encryption of `keySecret` and `webhookSecret` prior to DB upsert.
     - Response secret redaction check (confirming plaintext secrets are never returned).

### Integration & E2E Test Suite (`apps/backend/test/app.e2e-spec.ts`)
- **Execution Command**: `pnpm --filter backend test:e2e`
- **Coverage**:
  1. **`POST /api/v1/auth/register`**: Registers Merchant A & Merchant B, returns signed JWT access tokens.
  2. **`POST /api/v1/auth/login`**: Authenticates valid credentials, rejects invalid passwords (`401`).
  3. **`PUT /api/v1/merchant/credentials`**: Rejects unauthenticated requests (`401`); accepts valid Bearer token for Merchant A and stores encrypted credentials.
  4. **Direct DB Inspection**: Queries PostgreSQL `merchant_credentials` table to verify `encrypted_key_secret` and `encrypted_webhook_secret` match `iv:authTag:ciphertext` and are NOT stored in plaintext.
  5. **Cross-Tenant Isolation Verification**: Authenticates as Merchant B and attempts to access/modify credentials. Confirms Merchant B receives null metadata and Merchant A's data remains isolated.

### TypeScript Compilation & Build
- **Execution Command**: `pnpm --filter backend build`
- **Coverage**: Type checking across all auth DTOs, guards, strategies, and controllers.
