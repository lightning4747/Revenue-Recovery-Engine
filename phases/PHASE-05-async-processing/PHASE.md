# PHASE 05 — Asynchronous Queue & BullMQ Worker Subsystem

## 1. Purpose
Integrate Redis 7 and BullMQ (`@nestjs/bullmq`) into NestJS, establish the background event job queue (`webhookQueue`), implement the asynchronous queue processor/worker (`WebhookEventsProcessor`), configure 3-attempt exponential backoff retries, and enforce Layer 2 worker idempotency (`WebhookEvent.processingStatus == 'PROCESSED'`).

Executing failure detection, AI diagnosis, ERV calculation, policy evaluation, and Razorpay API recovery actions synchronously inside the HTTP webhook handler degrades throughput and risks HTTP timeouts. Moving heavy domain processing into an asynchronous background queue worker (CRIT-03) provides durable background execution and worker restart recovery without distributed system complexity.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 3 (*NFR-REL-001 Job Durability*): Durable background job processing and automatic worker restart recovery.
  * Section 4 (*NFR-ID-002 State Transition Idempotency*): Worker-level idempotency checks.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 5 (*Technology Strategy*): Redis 7 (`redis:7-alpine`) and BullMQ (`@nestjs/bullmq`) queue architecture.
  * Section 6 (*Backend Module Architecture*): `src/events/queues/` and `src/events/processors/` module layout.
  * Section 8.2 (*Asynchronous Queue & Worker Architecture*): Detailed 6-step worker flow, Layer 2 worker idempotency, retryable vs. non-retryable error classification, and configurable parameters (`WORKER_CONCURRENCY=5`, `JOB_MAX_RETRIES=3`, `JOB_BACKOFF_INITIAL_DELAY_MS=5000`).
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 3.1 & CRIT-03: Single microservice BullMQ queue worker architecture boundaries.

---

## 3. Prerequisites / Dependencies
* **PHASE-01 (Foundation)**: Requires Redis 7 Docker container and `pnpm` package manager.
* **PHASE-02 (Database)**: Requires `WebhookEvent` table schema and `processingStatus` enum.
* **PHASE-04 (Webhook Ingestion)**: Requires persisted `WebhookEvent` records (`processingStatus: 'PENDING'`).

---

## 4. Scope
* Configure `@nestjs/bullmq` module connecting to Redis 7 (`REDIS_URL`) via `pnpm`.
* Register `webhookQueue` producer in `RazorpayWebhookController`.
* Update HTTP Ingestion flow: After persisting `WebhookEvent` as `PENDING`, enqueue BullMQ job `{ eventId: webhookEvent.id }` before returning `HTTP 200 OK`.
* Implement `WebhookEventsProcessor` queue worker:
  * Fetch `WebhookEvent` from PostgreSQL by `eventId`.
  * **Worker Idempotency Check**: If `processingStatus == 'PROCESSED'`, skip job execution.
  * Update `processingStatus` $\rightarrow$ `'PROCESSING'`.
  * Dispatch event payload to domain pipeline.
  * Update `processingStatus` $\rightarrow$ `'PROCESSED'` with `processedAt` timestamp.
* Configure worker parameters:
  * `WORKER_CONCURRENCY`: Default `5`.
  * `JOB_MAX_RETRIES`: Default `3`.
  * `JOB_BACKOFF_INITIAL_DELAY_MS`: Default `5000` (exponential backoff).
* Implement job failure tracking: Mark `processingStatus` $\rightarrow$ `'FAILED'` and record `lastError` if retries exhaust.

---

## 5. Technical Implementation Requirements
1. **BullMQ Module Configuration with `pnpm`**:
   * Add dependencies via `pnpm`: `pnpm add @nestjs/bullmq bullmq`.
   * Configure `BullModule.forRootAsync` using `REDIS_URL` environment variable.
   * Register `webhookQueue` in `EventsModule`.
2. **Queue Producer Boundary**:
   * Update `RazorpayWebhookController`:
     ```typescript
     await this.webhookQueue.add('process-event', { eventId: webhookEvent.id }, {
       attempts: 3,
       backoff: { type: 'exponential', delay: 5000 },
     });
     ```
3. **Queue Processor / Worker Implementation**:
   * Create `WebhookEventsProcessor` annotated with `@Processor('webhookQueue')`.
   * Implement `@Process('process-event')` handler:
     ```typescript
     async process(job: Job<{ eventId: string }>) {
       const event = await this.webhookEventRepo.findOneBy({ id: job.data.eventId });
       if (!event || event.processingStatus === 'PROCESSED') return;
       
       await this.webhookEventRepo.update(event.id, { processingStatus: 'PROCESSING' });
       try {
         await this.domainPipeline.dispatch(event);
         await this.webhookEventRepo.update(event.id, {
           processingStatus: 'PROCESSED',
           processedAt: new Date(),
         });
       } catch (err) {
         if (job.attemptsMade >= job.opts.attempts) {
           await this.webhookEventRepo.update(event.id, {
             processingStatus: 'FAILED',
             lastError: err.message,
           });
         }
         throw err;
       }
     }
     ```

---

## 6. Files / Modules / Components Affected
```text
apps/backend/src/
├── events/
│   ├── events.module.ts
│   ├── queues/
│   │   └── webhook-queue.producer.ts
│   └── processors/
│       └── webhook-events.processor.ts
└── razorpay/
    └── webhooks/
        └── webhooks.controller.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **BullMQ Queue Registered**: `webhookQueue` in Redis 7.
* **Database State Mutations**: Updates `webhook_events.processing_status` from `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `PROCESSED` (or `FAILED`).

---

## 8. Acceptance Criteria
* Receiving a valid webhook enqueues a job into Redis `webhookQueue` and returns `HTTP 200 OK` immediately.
* BullMQ worker automatically picks up the job and transitions `WebhookEvent.processingStatus` from `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `PROCESSED`.
* Re-enqueuing a job for a `PROCESSED` event is skipped cleanly without re-executing domain pipeline.
* If downstream processing throws a transient exception, BullMQ reschedules the job up to 3 times with exponential backoff.
* If a job exhausts all retries, `WebhookEvent.processingStatus` is set to `'FAILED'` with `lastError` populated.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * BullMQ queue job creation upon webhook persistence.
  * Worker state transitions (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `PROCESSED`).
  * Worker idempotency check (skipping `PROCESSED` events).
  * Exponential backoff retry execution on transient exceptions (3 retries).
  * Terminal job failure handling (`FAILED` status and `lastError` persistence).
* **Verification Scope**: Unit tests for processor service; integration tests connecting NestJS worker to test Redis instance.

---

## 10. Definition of Done
* BullMQ job queue producer and worker running stably, transitioning event processing states cleanly, handling retries, and passing integration test suite executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* Kafka, RabbitMQ, SQS, or external message broker infrastructure.
* Transactional Outbox pattern or two-phase commit protocols.
* Domain failure detection / diagnosis logic (handled in Phases 06 & 07).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
