# Phase 04 Testing Strategy — Synchronous Webhook Ingestion Engine

## 1. Overview
This testing strategy covers unit, integration, and E2E verification for the synchronous Razorpay Webhook Ingestion Engine. The strategy verifies raw request body preservation (`req.rawBody`), constant-time HMAC SHA-256 signature verification (`crypto.timingSafeEqual`), decrypted merchant secret retrieval, JSON payload parsing, provider event identity extraction, database-level duplicate event handling (`UNIQUE(provider, provider_event_id)`), and event persistence into `webhook_events` (`processingStatus: 'PENDING'`).

---

## 2. Test Suites & Coverage

### Unit Test Suite (`apps/backend/src/`)
- **Execution Command**: `pnpm --filter backend test`
- **Coverage**:
  1. **`WebhookVerificationService` (`webhook-verification.service.spec.ts`)**:
     - HMAC SHA-256 digest calculation over raw request body Buffer.
     - Constant-time comparison using `crypto.timingSafeEqual`.
     - Buffer length mismatch handling (returning `false` without throwing exception).
     - Payload tampering detection (returns `false`).
     - Empty/missing parameters check (returns `false`).
  2. **`WebhooksService` (`webhooks.service.spec.ts`)**:
     - Scoped database credential lookup for target merchant (`merchantId`).
     - AES-256-GCM secret decryption using `CryptoService`.
     - Invalid merchant credentials detection (`BadRequestException('Invalid webhook signature')`).
     - Malformed JSON payload detection (`BadRequestException('Malformed JSON payload')`).
     - Event envelope extraction (`providerEventId` from header `X-Razorpay-Event-Id` or `payload.event_id`, `eventType` from `payload.event`).
     - Layer 1 query deduplication (returns `status: 'acknowledged', duplicate: true`).
     - Layer 2 PostgreSQL unique constraint handling (`code 23505`) for concurrent duplicates.
     - Successful persistence into `webhook_events` (`processingStatus: 'PENDING'`).
  3. **`RazorpayWebhookController` (`webhooks.controller.spec.ts`)**:
     - Routing `POST /api/v1/webhooks/razorpay/:merchantId`.
     - Validation of `@RawBody()` Buffer parameter.
     - Validation of `X-Razorpay-Signature` header parameter.
     - Delegation to `WebhooksService` and `HTTP 200 OK` response returning.

---

### Integration & E2E Test Suite (`apps/backend/test/app.e2e-spec.ts`)
- **Execution Command**: `pnpm --filter backend test:e2e`
- **Coverage**:
  1. **`POST /api/v1/webhooks/razorpay/:merchantId` missing signature**: Rejects request with `400 Bad Request`.
  2. **`POST /api/v1/webhooks/razorpay/:merchantId` tampered payload**: Rejects request with `400 Bad Request` (`Invalid webhook signature`) and creates zero records in database.
  3. **`POST /api/v1/webhooks/razorpay/:merchantId` valid signature**: Accepts request, responds `200 OK` within $< 50\text{ms}$, and persists `WebhookEvent` record in PostgreSQL (`processingStatus: 'PENDING'`).
  4. **Idempotency & Duplicate Delivery**: Resending exact duplicate payload returns `200 OK` (`duplicate: true`, `status: 'acknowledged'`) without creating duplicate database rows.

---

### Local Webhook Ingress Test Workflow (zrok)
- **Script Command**: `pnpm tunnel`
- **Coverage**:
  - Exposes local HTTP port over secure zrok tunnel (`https://<zrok-public-url>`).
  - Allows end-to-end webhook delivery testing from real Razorpay Test Dashboard to `POST /api/v1/webhooks/razorpay/:merchantId`.

---

### TypeScript Compilation & Build
- **Execution Command**: `pnpm --filter backend build`
- **Coverage**: Type checking across controller, service, verification service, schemas, and NestJS module dependencies.
