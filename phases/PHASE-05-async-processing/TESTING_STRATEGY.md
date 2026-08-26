# Phase 05 Testing Strategy: Asynchronous Queue & BullMQ Worker Subsystem

## 1. Objective & Scope
The objective of Phase 05 testing is to empirically verify that authentic webhook events persisted in PostgreSQL (`processingStatus: 'PENDING'`) are enqueued into Redis 7 via BullMQ (`webhookQueue`), picked up by the background worker (`WebhookEventsProcessor`), idempotently processed, and transitioned to `PROCESSED` (or `FAILED` with `lastError` recorded on max attempt exhaustion).

---

## 2. Test Pyramid & Methodology

```text
               / \
              /   \     E2E Integration Test (15 Tests)
             / E2E \    - App + DB + Redis 7 Container + BullMQ Worker
            /-------\
           / Unit    \  Unit Test Suites (12 Suites / 42 Tests)
          /  Tests    \ - WebhookEventsProcessor & WebhooksService Enqueue
         /-------------\
```

### A. Unit Testing (`apps/backend/src/events/processors/webhook-events.processor.spec.ts`)
- **Worker Lifecycle**: `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `PROCESSED` status transition verification.
- **Layer 2 Idempotency**: Skipping events that are already marked `PROCESSED`.
- **Max Attempt Exhaustion**: Transitioning status to `FAILED` and recording `lastError` when 3 total attempts fail.
- **Service Enqueueing**: `WebhooksService` enqueueing job into `webhookQueue` on event insertion, with graceful handling of Redis enqueue errors (`REDIS_ENQUEUE_FAILED`).

### B. End-to-End Integration Testing (`apps/backend/test/app.e2e-spec.ts`)
- Live Redis 7 container and PostgreSQL 15 integration testing.
- Verifying HTTP POST `/api/v1/webhooks/razorpay/:merchantId` enqueues BullMQ job.
- Asynchronous worker polling verification: Verifying `processingStatus` transitions to `PROCESSED` with `processedAt` timestamp set.

### C. Live Microservice Verification (`pnpm webhook:test`)
- Real-time developer script HTTP test against running Docker container (`rre-backend`).
- Querying PostgreSQL table `webhook_events` to verify `processingStatus` = `'PROCESSED'`.

---

## 3. Execution Commands
```bash
# Unit Tests
pnpm --filter backend test

# E2E Integration Tests
pnpm --filter backend test:e2e

# Live Local Webhook Developer Test
pnpm webhook:test
```
