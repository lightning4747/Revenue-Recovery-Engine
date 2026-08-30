# Phase 06 Testing Strategy: Failure & Degradation Detection Engine

## 1. Objective & Scope
The objective of Phase 06 testing is to verify that incoming Razorpay payment events processed asynchronously by `WebhookEventsProcessor` are ingested into `PaymentTelemetry` and parsed by `FailureDetectionService` to instantiate `RecoveryOpportunity` records (`sourceType: 'FAILED_PAYMENT'`, `status: 'OBSERVED'`), and that `DegradationDetectionService` correctly identifies rolling 1-hour bank success rate drops $> 20\%$ to instantiate `DEGRADATION` opportunities.

---

## 2. Test Pyramid & Methodology

```text
               / \
              /   \     E2E Integration Test Suite (17 Tests)
             / E2E \    - App + DB + Redis + BullMQ Queue + Detection Engine
            /-------\
           / Unit    \  Unit Test Suites (16 Suites / 54 Tests)
          /  Tests    \ - Telemetry, FailureDetection, DegradationDetection, Detection Services
         /-------------\
```

### A. Unit Testing (`apps/backend/src/revenue/detection/`)
- `telemetry.service.spec.ts`: Test extraction of paymentMethod, bank, status, failureReason, and amount.
- `failure-detection.service.spec.ts`: Test parsing of `payment.failed` webhooks, deduplication against existing opportunities, and `RecoveryOpportunity` instantiation (`status = 'OBSERVED'`).
- `degradation-detection.service.spec.ts`: Test trailing 1-hour window success rate math, sample count requirement (`sampleCount >= 10`), anomaly drop threshold ($> 20\%$), and `DEGRADATION` opportunity creation.
- `detection.service.spec.ts`: Test facade orchestration across telemetry and failure detection.

### B. End-to-End Integration Testing (`apps/backend/test/app.e2e-spec.ts`)
- `Phase 06 Detection Engine - should create FAILED_PAYMENT RecoveryOpportunity with status OBSERVED on payment.failed event`: Validates full async pipeline from HTTP POST webhook ingestion to PostgreSQL `recovery_opportunities` record creation.
- `Phase 06 Detection Engine - should aggregate 1h rolling telemetry and trigger DEGRADATION opportunity`: Validates rolling 1-hour window calculation and baseline degradation flagging.

---

## 3. Verification Execution Commands
```bash
# Unit Tests
pnpm --filter backend test

# E2E Integration Tests
pnpm test:e2e

# Live Developer Script Test
pnpm webhook:test
```
