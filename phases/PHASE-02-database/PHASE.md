# PHASE 02 — Database & Domain Entity Layer

## 1. Purpose
Establish PostgreSQL database connections using Drizzle ORM, define canonical domain database schemas, configure integer minor-unit (paise) monetary fields, set up database constraints and unique indexes, and create reproducible database migrations with `drizzle-kit`.

Defining exact schema models, minor-unit monetary precision (paise), unique constraints, and foreign key relations upfront guarantees data integrity and multi-tenant isolation before business logic implementation begins.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 9 (*Event Store*): `WebhookEvent` table schema and composite constraint `UNIQUE (provider, providerEventId)`.
  * Section 11 (*Domain Data Models & Tenant Schema*): `Merchant`, `MerchantCredential`, `UserSession`, `RecoveryOpportunity`, `RecoveryPayment`, `PaymentTelemetry`, and `BankPerformanceBaseline` data models.
  * Section 24 (*Database Strategy*): PostgreSQL 15 database strategy and migration requirements.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 3 (*NFR-FC-001 Verified Revenue Only* & *NFR-FC-003 Minor Unit Monetary Precision*): Standardize all monetary database fields to integer minor units (paise) using `bigint` / `integer`.
  * Section 9 (*NFR-SEC-005 Multi-Tenant Isolation*): Enforce mandatory `merchantId` foreign keys on all domain tables.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 8 (*Data & State Model Validation*): Schema definitions, composite unique indexes, and minor-unit monetary field requirements.

---

## 3. Prerequisites / Dependencies
* **PHASE-01 (Foundation)**: Requires monorepo application baseline (`apps/backend/`), environment validation, `pnpm` package manager, and Docker Compose PostgreSQL container.

---

## 4. Scope
* Set up Drizzle ORM database module with `pg` connection pooling in `apps/backend/src/database/`.
* Create `drizzle.config.ts` in `apps/backend/` for `drizzle-kit` schema generation and migrations.
* Define Drizzle schema tables (`pgTable`) for all core domain entities:
  * `merchants`
  * `merchant_credentials`
  * `user_sessions`
  * `webhook_events`
  * `recovery_opportunities`
  * `recovery_payments`
  * `payment_telemetry`
  * `bank_performance_baselines`
  * `audit_events`
* Configure composite `uniqueIndex` constraints:
  * `uniqueIndex('idx_provider_event').on(webhookEvents.provider, webhookEvents.providerEventId)`
  * `uniqueIndex('idx_merchant_payment').on(recoveryPayments.merchantId, recoveryPayments.razorpayPaymentId)`
  * `uniqueIndex('idx_bank_baseline').on(bankPerformanceBaselines.merchantId, bankPerformanceBaselines.paymentMethod, bankPerformanceBaselines.bank)`
* Generate and execute initial database migration SQL files via `drizzle-kit`.

---

## 5. Technical Implementation Requirements
1. **Drizzle ORM Module Integration with `pnpm`**:
   * Add dependencies via `pnpm`: `pnpm --filter backend add drizzle-orm pg`.
   * Add dev dependencies: `pnpm --filter backend add -D drizzle-kit @types/pg`.
   * Create `apps/backend/drizzle.config.ts` configured for PostgreSQL schema discovery (`./src/database/schema/*`) and output migrations (`./drizzle`).
   * Create `DatabaseModule` providing Drizzle database instance connected to PostgreSQL via `pg.Pool` using validated `DATABASE_URL`.

2. **Domain Table Schema Definitions (`apps/backend/src/database/schema/`)**:
   * `merchants`: Primary key `id` (`varchar`), `businessName` (`varchar`), `email` (`varchar`), `currency` (`varchar`, default: 'INR'), timestamps (`createdAt`, `updatedAt`).
   * `merchantCredentials`: `id` (`uuid`), `merchantId` (`varchar`, FK ──► `merchants.id`), `keyId` (`varchar`), `encryptedKeySecret` (`varchar`), `webhookSecret` (`varchar`), timestamps.
   * `userSessions`: `id` (`uuid`), `merchantId` (`varchar`, FK), `userId` (`varchar`), `tokenHash` (`varchar`), `expiresAt` (`timestamp`), `createdAt` (`timestamp`).
   * `webhookEvents`: `id` (`uuid`), `provider` (`varchar`, default: 'razorpay'), `providerEventId` (`varchar`), `eventType` (`varchar`), `payload` (`jsonb`), `receivedAt` (`timestamp`), `processedAt` (`timestamp`), `processingStatus` (`varchar`: `'PENDING'`, `'PROCESSING'`, `'PROCESSED'`, `'FAILED'`), `attemptCount` (`integer`, default: 0), `lastError` (`text`). Composite index: `uniqueIndex('idx_provider_event').on(provider, providerEventId)`.
   * `recoveryOpportunities`: `id` (`varchar`, e.g., 'opp_...'), `merchantId` (`varchar`, FK), `sourceType` (`varchar`), `sourceId` (`varchar`), `originalTransactionId` (`varchar`), `originalOrderId` (`varchar`), `lastReferenceId` (`varchar`), `lastPaymentLinkId` (`varchar`), `lastPaymentLinkUrl` (`varchar`), `amount` (`bigint` paise integer), `recoveredAmount` (`bigint` paise integer, default: 0), `remainingAmount` (`bigint` paise integer), `currency` (`varchar`), `cause` (`varchar`), `causeConfidence` (`real`), `recoveryProbability` (`real`), `interventionCost` (`bigint`), `expectedRecoveryValue` (`bigint`), `priorityScore` (`real`), `status` (`varchar`: 12 canonical enums), `attemptCount` (`integer`), timestamps, `resolvedAt` (`timestamp`).
   * `recoveryPayments`: `id` (`uuid`), `merchantId` (`varchar`, FK), `opportunityId` (`varchar`, FK), `paymentLinkId` (`varchar`), `razorpayPaymentId` (`varchar`), `amount` (`bigint` paise integer), `status` (`varchar`: 'CAPTURED'), `createdAt` (`timestamp`). Composite index: `uniqueIndex('idx_merchant_payment').on(merchantId, razorpayPaymentId)`.
   * `paymentTelemetry`: `id` (`uuid`), `merchantId` (`varchar`, FK), `paymentMethod` (`varchar`), `bank` (`varchar`), `status` (`varchar`), `failureReason` (`varchar`), `amount` (`bigint` paise integer), `timestamp` (`timestamp`).
   * `bankPerformanceBaselines`: `id` (`uuid`), `merchantId` (`varchar`, FK), `paymentMethod` (`varchar`), `bank` (`varchar`), `baselineSuccessRate` (`real`), `currentSuccessRate` (`real`), `sampleCount` (`integer`), `degradationFlagged` (`boolean`), `updatedAt` (`timestamp`). Composite index: `uniqueIndex('idx_bank_baseline').on(merchantId, paymentMethod, bank)`.
   * `auditEvents`: `id` (`uuid`), `merchantId` (`varchar`, FK), `opportunityId` (`varchar`, FK), `eventType` (`varchar`), `actor` (`varchar`), `userExplanation` (`varchar`), `technicalSnapshot` (`jsonb`), `timestamp` (`timestamp`).

3. **Database Migrations & Tooling Setup**:
   * Add scripts to `apps/backend/package.json`:
     - `"db:generate": "drizzle-kit generate"`
     - `"db:migrate": "drizzle-kit migrate"`
     - `"db:studio": "drizzle-kit studio"`
   * Generate initial SQL migration using `pnpm --filter backend db:generate`.

---

## 6. Files / Modules / Components Affected
```text
apps/backend/
├── drizzle.config.ts
├── drizzle/
│   └── 0000_initial_schema.sql
└── src/
    └── database/
        ├── database.module.ts
        ├── database.provider.ts
        └── schema/
            ├── index.ts
            ├── merchants.schema.ts
            ├── merchant-credentials.schema.ts
            ├── user-sessions.schema.ts
            ├── webhook-events.schema.ts
            ├── recovery-opportunities.schema.ts
            ├── recovery-payments.schema.ts
            ├── payment-telemetry.schema.ts
            ├── bank-performance-baselines.schema.ts
            └── audit-events.schema.ts
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
* **Constraints**: Composite `uniqueIndex` on `webhook_events(provider, provider_event_id)`, `recovery_payments(merchant_id, razorpay_payment_id)`, and `bank_performance_baselines(merchant_id, payment_method, bank)`.

---

## 8. Acceptance Criteria
* Drizzle ORM module connects to PostgreSQL database using `pg.Pool`.
* `drizzle-kit generate` produces clean SQL migration scripts without errors.
* Database migration runs cleanly against PostgreSQL container.
* All monetary columns are defined as `bigint` / `integer` minor units (paise).
* Duplicate insert on `(provider, provider_event_id)` into `webhook_events` raises a database unique constraint violation.
* Duplicate insert on `(merchant_id, razorpay_payment_id)` into `recovery_payments` raises a database unique constraint violation.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Drizzle migration generation and execution (`pnpm --filter backend db:generate` & `pnpm --filter backend db:migrate`).
  * Table creation and column types in PostgreSQL (`bigint` for monetary fields).
  * Database unique index enforcement on `webhook_events` and `recovery_payments`.
* **Verification Scope**: Integration test suite verifying Drizzle schema operations against PostgreSQL database.

---

## 10. Definition of Done
* All 9 domain table schemas created with Drizzle ORM (`pgTable`), minor-unit monetary fields and composite unique indexes configured, `drizzle-kit` migrations generated and executed, and integration tests passing.

---

## 11. Explicitly Out of Scope
* Webhook HTTP controllers or raw request body parsing (handled in Phase 04).
* BullMQ queue setup or background workers (handled in Phase 05).
* REST API endpoints for merchant onboarding (handled in Phase 03).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
