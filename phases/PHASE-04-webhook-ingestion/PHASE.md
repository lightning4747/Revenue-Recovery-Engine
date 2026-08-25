# PHASE 04 — Synchronous Webhook Ingestion Engine

## 1. Purpose
Implement the synchronous Webhook Ingestion HTTP Controller, preserving unparsed request body Buffer (`req.rawBody`), validating HMAC SHA-256 signatures against `X-Razorpay-Signature`, enforcing database-level duplicate check via `UNIQUE (provider, providerEventId)`, and persisting authentic `WebhookEvent` records with `processingStatus: 'PENDING'` within a target response budget of $< 50\text{ms}$.

Webhook ingestion is the primary event entry point for all incoming Razorpay payment telemetry. Validating cryptographic HMAC signatures against unparsed raw body bytes before parsing or saving payloads is mandatory to prevent signature forgery attacks (CRIT-01). Enforcing atomic database-level deduplication prevents duplicate event processing (MED-02).

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 6 (*FR-003 Webhook Ingestion*): Synchronous webhook ingestion and event store persistence.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 1 (*NFR-PERF-001 Response Latency*): Ingestion response budget $< 50\text{ms}$.
  * Section 2 (*NFR-SEC-003 Webhook Signature Verification*): Mandatory HMAC SHA-256 verification against unparsed raw request body bytes.
  * Section 4 (*NFR-ID-001 Webhook Event Idempotency*): Concurrency-safe event deduplication.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 8 (*Webhook Ingestion*): Detailed 6-step ingestion pipeline flowchart.
  * Section 8.1 (*Raw Body Preservation & HMAC Signature Verification*): NestJS `rawBody: true` buffer preservation, `crypto.timingSafeEqual` comparison, and JSON re-stringification prohibition.
  * Section 9 (*Event Store*): `WebhookEvent` schema and composite constraint `UNIQUE (provider, providerEventId)`.
* **[`RAZORPAY_CAPABILITY_MATRIX.md`](../../docs/RAZORPAY_CAPABILITY_MATRIX.md)**:
  * Webhook Capabilities (`payment.failed`, `payment_link.paid`, `payment_link.partially_paid`).
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 3.1 & CRIT-01: Synchronous HMAC validation and raw-body preservation rules.

---

## 3. Prerequisites / Dependencies
* **PHASE-01 (Foundation)**: Requires NestJS application foundation and `pnpm` package manager.
* **PHASE-02 (Database)**: Requires `WebhookEvent` table schema with composite constraint `UNIQUE (provider, providerEventId)`.
* **PHASE-03 (Authentication & Merchant)**: Requires merchant credentials and `webhookSecret` lookup.

---

## 4. Scope
* Enable `rawBody: true` in NestJS application setup (`NestFactory.create`).
* Implement `RazorpayWebhookController` (`POST /api/v1/webhooks/razorpay/:merchantId`).
* Implement `WebhookVerificationService`:
  * Extract `X-Razorpay-Signature` and `X-Razorpay-Event-Id` headers.
  * Retrieve `webhookSecret` for target merchant.
  * Compute HMAC SHA-256 digest against unparsed `req.rawBody` Buffer.
  * Perform constant-time equality check (`crypto.timingSafeEqual`).
* Implement JSON payload parsing and identity extraction (`providerEventId`, `eventType`).
* Implement database persistence of `WebhookEvent` (`processingStatus: 'PENDING'`).
* Implement HTTP response logic:
  * Invalid signature $\rightarrow$ `HTTP 400 Bad Request` (Do NOT persist).
  * Duplicate event $\rightarrow$ `HTTP 200 OK` (Acknowledge & terminate).
  * Valid new event persistence $\rightarrow$ `HTTP 200 OK` (Acknowledge).

---

## 5. Technical Implementation Requirements
1. **NestJS Raw Body Preservation Setup**:
   * Update `main.ts` initialization: `NestFactory.create(AppModule, { rawBody: true })`.
   * Ensure standard body-parser middleware does NOT re-serialize JSON before HMAC computation.
2. **HMAC Signature Verification Service**:
   * Create `WebhookVerificationService`:
     ```typescript
     verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
       const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
       return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
     }
     ```
3. **Webhook Ingestion Controller**:
   * Create `RazorpayWebhookController`: `POST /api/v1/webhooks/razorpay/:merchantId`.
   * Extract `req.rawBody`, `X-Razorpay-Signature`, and `X-Razorpay-Event-Id`.
   * Load merchant's `webhookSecret` from `MerchantCredential` table.
   * Verify signature using `WebhookVerificationService`. If invalid, log security warning and return `HTTP 400 Bad Request` immediately.
4. **Payload Identity & Deduplication Handling**:
   * Parse `req.rawBody` into JSON payload object.
   * Extract `providerEventId` from header `X-Razorpay-Event-Id` or payload root `event_id`.
   * Query `WebhookEvent` table for existing `(provider, providerEventId)`. If duplicate exists, log notice and return `HTTP 200 OK`.
   * Save new `WebhookEvent` record (`processingStatus: 'PENDING'`). Catch PostgreSQL unique constraint violations gracefully to handle race conditions.
   * Return `HTTP 200 OK` immediately.

---

## 6. Files / Modules / Components Affected
```text
apps/backend/src/
├── main.ts
└── razorpay/
    └── webhooks/
        ├── webhooks.module.ts
        ├── webhooks.controller.ts
        ├── webhooks.service.ts
        └── verification/
            └── webhook-verification.service.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **API Endpoints**: `POST /api/v1/webhooks/razorpay/:merchantId` (Public endpoint, signature protected).
* **Database Updates**: Inserts verified records into `webhook_events` (`processingStatus: 'PENDING'`).

---

## 8. Acceptance Criteria
* Sending a webhook with a valid `X-Razorpay-Signature` calculated against `req.rawBody` returns `HTTP 200 OK` and creates a `WebhookEvent` record (`processingStatus: 'PENDING'`).
* Sending a webhook with an altered payload or invalid signature returns `HTTP 400 Bad Request` and creates NO database record.
* Resending the exact same webhook payload returns `HTTP 200 OK` without creating duplicate records.
* Ingestion processing finishes in $< 50\text{ms}$.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Raw binary request body Buffer preservation (`req.rawBody`).
  * Constant-time HMAC SHA-256 signature verification against valid/invalid signatures.
  * Rejection of re-stringified JSON objects.
  * Ingestion latency budget ($< 50\text{ms}$).
  * Database unique constraint violation catch on concurrent duplicate webhooks.
* **Verification Scope**: Unit tests for HMAC verification service; integration HTTP tests delivering valid, tampered, and duplicate webhook payloads.

---

## 10. Definition of Done
* Webhook controller receiving, signature validating, deduplicating, and persisting `WebhookEvent` records cleanly with passing automated test suite executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* BullMQ asynchronous queue job creation (handled in Phase 05).
* Domain processing pipeline / AI diagnosis / ERV calculation inside HTTP controller (strictly prohibited).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
