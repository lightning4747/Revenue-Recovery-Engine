# Phase 02 Testing Strategy — Database & Domain Entity Layer

## 1. Overview
This strategy covers automated and integration testing of the Drizzle ORM database layer, PostgreSQL schema creation, column data types (`BIGINT` paise minor units), multi-tenant foreign key relationships, and composite unique indexes.

## 2. Test Suites & Execution

### Integration Test Suite (`apps/backend/src/database/database.spec.ts`)
- **Execution Command**: `pnpm --filter backend test`
- **Scope & Coverage**:
  1. **Database Connection & Schema Existence**: Connects to PostgreSQL container and queries `information_schema.tables` to verify creation of `merchants`, `webhook_events`, `recovery_opportunities`, and `recovery_payments`.
  2. **Monetary Precision Check**: Queries `information_schema.columns` to verify `amount`, `recovered_amount`, and `remaining_amount` in `recovery_opportunities` are stored as PostgreSQL `bigint`.
  3. **Event Store Uniqueness (`webhook_events`)**: Inserts duplicate `(provider, provider_event_id)` records to verify PostgreSQL composite unique index violation handling (`idx_provider_event`).
  4. **Financial Idempotency Uniqueness (`recovery_payments`)**: Inserts duplicate `(merchant_id, razorpay_payment_id)` records to verify composite unique index enforcement (`idx_merchant_payment`).
  5. **Tenant Isolation Foreign Keys**: Inserts valid merchant and child records, verifying foreign key relationship constraints (`ON DELETE CASCADE`).

### E2E Application Test Suite (`apps/backend/test/app.e2e-spec.ts`)
- **Execution Command**: `pnpm --filter backend test:e2e`
- **Scope**: Verifies that the NestJS application boots cleanly with `DatabaseModule` imported and `/health` endpoint remains functional.

### Compilation Check
- **Execution Command**: `pnpm --filter backend build`
- **Scope**: Strict TypeScript type checking across all Drizzle table schemas and providers.
