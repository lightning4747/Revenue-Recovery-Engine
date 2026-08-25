# PHASE 02 — Database & Domain Entity Layer

## 1. Purpose
Establish PostgreSQL database connections using TypeORM, define canonical domain entity schemas, configure integer minor-unit (paise) monetary fields, set up database constraints and unique indexes, and create reproducible database migrations.

Defining exact entity models, minor-unit monetary precision (paise), unique constraints, and foreign key relations upfront guarantees data integrity and multi-tenant isolation before business logic implementation begins.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 9 (*Event Store*): `WebhookEvent` entity schema and composite constraint `UNIQUE (provider, providerEventId)`.
  * Section 11 (*Domain Data Models & Tenant Schema*): `Merchant`, `MerchantCredential`, `UserSession`, `RecoveryOpportunity`, `RecoveryPayment`, `PaymentTelemetry`, and `BankPerformanceBaseline` entity schemas.
  * Section 24 (*Database Strategy*): PostgreSQL 15 database strategy and migration requirements.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 1 (*NFR-FC-001 Verified Revenue Only* & *NFR-FC-003 Minor Unit Monetary Precision*): Standardize all monetary database fields to integer minor units (paise) using `BIGINT` / `INTEGER`.
  * Section 2 (*NFR-SEC-005 Multi-Tenant Isolation*): Enforce mandatory `merchantId` foreign keys on all domain entities.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 8 (*Data & State Model Validation*): Entity schemas, composite unique indexes, and minor-unit monetary field requirements.

---

## 3. Prerequisites / Dependencies
* **PHASE-01 (Foundation)**: Requires application baseline, environment validation, `pnpm` package manager, and Docker Compose PostgreSQL container.

---

## 4. Scope
* Set up TypeORM database module with connection pooling and SSL options via `pnpm`.
* Create TypeORM entities for all core domain tables:
  * `Merchant`
  * `MerchantCredential`
  * `UserSession`
  * `WebhookEvent`
  * `RecoveryOpportunity`
  * `RecoveryPayment`
  * `PaymentTelemetry`
  * `BankPerformanceBaseline`
  * `AuditEvent`
* Configure composite `UNIQUE` indexes:
  * `UNIQUE (provider, providerEventId)` on `WebhookEvent`.
  * `UNIQUE (merchantId, razorpayPaymentId)` on `RecoveryPayment`.
  * `UNIQUE (merchantId, paymentMethod, bank)` on `BankPerformanceBaseline`.
* Implement initial database migration script (`001-initial-schema.ts`).

---

## 5. Technical Implementation Requirements
1. **TypeORM Module Integration with `pnpm`**:
   * Add dependencies via `pnpm`: `pnpm add @nestjs/typeorm typeorm pg`.
   * Configure `TypeOrmModule` in `AppModule` using validated environment variables (`DATABASE_URL`, connection pool min/max).
2. **Domain Entity Definitions**:
   * `MerchantEntity`: Primary key `id` (ULID/String), `businessName`, `email`, `currency` (default: 'INR'), timestamps.
   * `MerchantCredentialEntity`: `id`, `merchantId` (FK), `keyId`, `encryptedKeySecret`, `webhookSecret`, timestamps.
   * `UserSessionEntity`: `id`, `merchantId` (FK), `userId`, `tokenHash`, `expiresAt`.
   * `WebhookEventEntity`: `id`, `provider`, `providerEventId`, `eventType`, `payload` (JSONB), `receivedAt`, `processedAt`, `processingStatus` (`PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`), `attemptCount`, `lastError`. Add composite index `idx_provider_event (provider, providerEventId)`.
   * `RecoveryOpportunityEntity`: `id` (e.g., 'opp_...'), `merchantId` (FK), `sourceType`, `sourceId`, `originalTransactionId`, `originalOrderId`, `lastReferenceId`, `lastPaymentLinkId`, `lastPaymentLinkUrl`, `amount` (paise integer), `recoveredAmount` (paise integer), `remainingAmount` (paise integer), `currency`, `cause`, `causeConfidence`, `recoveryProbability`, `interventionCost`, `expectedRecoveryValue`, `priorityScore`, `status` (12 canonical enums), `attemptCount`, timestamps, `resolvedAt`.
   * `RecoveryPaymentEntity`: `id`, `merchantId` (FK), `opportunityId` (FK), `paymentLinkId`, `razorpayPaymentId`, `amount` (paise integer), `status` ('CAPTURED'), `createdAt`. Add composite index `idx_merchant_payment (merchantId, razorpayPaymentId)`.
   * `PaymentTelemetryEntity`: `id`, `merchantId` (FK), `paymentMethod`, `bank`, `status`, `failureReason`, `amount` (paise integer), `timestamp`.
   * `BankPerformanceBaselineEntity`: `id`, `merchantId` (FK), `paymentMethod`, `bank`, `baselineSuccessRate`, `currentSuccessRate`, `sampleCount`, `degradationFlagged`, `updatedAt`. Add composite index `idx_bank_baseline (merchantId, paymentMethod, bank)`.
   * `AuditEventEntity`: `id`, `merchantId` (FK), `opportunityId` (FK), `eventType`, `actor`, `userExplanation` (sanitized string), `technicalSnapshot` (JSONB), `timestamp`.
3. **Database Migrations Setup**:
   * Configure TypeORM CLI migration scripts in `package.json` using `pnpm`:
     `"typeorm": "pnpm run ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js"`
   * Generate `1700000000000-InitialSchema.ts` migration script.

---

## 6. Files / Modules / Components Affected
```text
src/
├── database/
│   ├── database.module.ts
│   ├── migrations/
│   │   └── 1700000000000-InitialSchema.ts
│   └── entities/
│       ├── merchant.entity.ts
│       ├── merchant-credential.entity.ts
│       ├── user-session.entity.ts
│       ├── webhook-event.entity.ts
│       ├── recovery-opportunity.entity.ts
│       ├── recovery-payment.entity.ts
│       ├── payment-telemetry.entity.ts
│       ├── bank-performance-baseline.entity.ts
│       └── audit-event.entity.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **Database Tables Created**:
  * `merchants`
  * `merchant_credentials`
  * `user_sessions`
  * `webhook_events`
  * `recovery_opportunities`
  * `recovery_payments`
  * `payment_telemetry`
  * `bank_performance_baselines`
  * `audit_events`
* **Constraints**: Composite `UNIQUE` indexes on `webhook_events(provider, provider_event_id)`, `recovery_payments(merchant_id, razorpay_payment_id)`, and `bank_performance_baselines(merchant_id, payment_method, bank)`.

---

## 8. Acceptance Criteria
* TypeORM successfully connects to PostgreSQL container on startup.
* Migration `1700000000000-InitialSchema.ts` runs cleanly without SQL errors.
* All monetary columns are created as `BIGINT` / `INTEGER` minor units in PostgreSQL schema.
* Attempting to insert duplicate `(provider, provider_event_id)` into `webhook_events` raises a database unique constraint violation error.
* Attempting to insert duplicate `(merchant_id, razorpay_payment_id)` into `recovery_payments` raises a database unique constraint violation error.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Database migration execution (`pnpm run typeorm migration:run` and `migration:revert`).
  * Entity column types in PostgreSQL (confirming `BIGINT` for monetary attributes).
  * Database unique index enforcement on `webhook_events` and `recovery_payments`.
* **Verification Scope**: Integration tests connecting to test PostgreSQL database.

---

## 10. Definition of Done
* All 9 domain entities created with minor-unit monetary fields and unique constraints, migrations generated and executed via `pnpm`, and integration tests passing.

---

## 11. Explicitly Out of Scope
* Webhook HTTP controllers or raw request body preservation (handled in Phase 04).
* BullMQ queue setup or background workers (handled in Phase 05).
* REST API endpoints for merchant onboarding (handled in Phase 03).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
