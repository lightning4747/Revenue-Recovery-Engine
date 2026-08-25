# Revenue Recovery Engine (RRE) — Phased Implementation Roadmap

## 1. Purpose of the Phases Directory

This directory contains the authoritative, step-by-step phased implementation roadmap for building the **Revenue Recovery Engine (RRE)**. It is derived directly from the validated project specifications:
* [`FUNCTIONAL_REQUIREMENTS.md`](../docs/FUNCTIONAL_REQUIREMENTS.md)
* [`NON_FUNCTIONAL_REQUIREMENTS.md`](../docs/NON_FUNCTIONAL_REQUIREMENTS.md)
* [`IMPLEMENTATION_STRATEGY.md`](../docs/IMPLEMENTATION_STRATEGY.md)
* [`RAZORPAY_CAPABILITY_MATRIX.md`](../docs/RAZORPAY_CAPABILITY_MATRIX.md)
* [`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)

An implementation agent or developer can execute this roadmap sequentially without having to rediscover the architecture or make major architectural design choices.

---

## 2. Architecture & Scope Boundary

The project is designed as a **production-quality simple microservice MVP**.

### Standard Package Manager:
The standard package manager for this project is **`pnpm`**. All dependency management, lockfile generation (`pnpm-lock.yaml`), script execution (`pnpm run ...`), and container builds MUST use `pnpm`.

### Core Stack:
```text
NestJS (TypeScript) Application Process
  ├── Synchronous HTTP Controllers (Webhook Raw Body Ingestion & Auth REST APIs)
  └── Asynchronous Queue Worker Processors (@nestjs/bullmq)
        │
        ├── PostgreSQL 15 (Authoritative Database & State Store)
        └── Redis 7 (Backing Store for BullMQ Job Queues)
              │
              └── Docker Compose (Local Orchestration & Deployment Containerization)
```

### Explicit Prohibitions (Out-of-Scope Infrastructure):
Do **NOT** introduce or plan for:
* Kafka, RabbitMQ, AWS SQS/SNS, or external message brokers.
* Microservice-to-microservice RPC or service mesh.
* Kubernetes, Helm, or complex cloud orchestration.
* Distributed transactions, 2PC, or Transactional Outbox patterns.
* Event sourcing, CQRS, or distributed event buses.
* Distributed locking infrastructure beyond standard PostgreSQL database locks.
* Unnecessary enterprise HA infrastructure or multi-region failover.

---

## 3. Phase Dependency Graph & Ordering

```text
[PHASE 01: Foundation & Infrastructure Setup]
       │
       ▼
[PHASE 02: Database & Domain Entity Layer]
       │
       ▼
[PHASE 03: Merchant Authentication & Tenant Security]
       │
       ▼
[PHASE 04: Synchronous Webhook Ingestion Engine]
       │
       ▼
[PHASE 05: Asynchronous Queue & BullMQ Worker Subsystem]
       │
       ▼
[PHASE 06: Failure & Degradation Detection Engine]
       │
       ▼
[PHASE 07: Root-Cause Diagnosis & ERV Calculation Engine]
       │
       ▼
[PHASE 08: Prioritization, Policy Gating & Opportunity State Engine]
       │
       ▼
[PHASE 09: Dynamic Recovery Action Layer (Razorpay Payment Links)]
       │
       ▼
[PHASE 10: Financial Verification & Partial Payment Ledger Engine]
       │
       ▼
[PHASE 11: Control Tower Dashboard & Audit UI Subsystem]
       │
       ▼
[PHASE 12: End-to-End System Hardening, Integration Verification & Dockerization]
```

---

## 4. Phase Overview

| Phase | Title | Objective & Summary | Prerequisites |
| :--- | :--- | :--- | :--- |
| **Phase 01** | `PHASE-01-foundation` | Establish NestJS project, `pnpm` configuration, environment validation, logger, exception filters, and Docker Compose baseline. | None |
| **Phase 02** | `PHASE-02-database` | Configure Drizzle ORM/PostgreSQL migrations, database schemas (`Merchant`, `WebhookEvent`, `RecoveryOpportunity`, `RecoveryPayment`, etc.), constraints, and integer minor-unit (paise) fields. | Phase 01 |
| **Phase 03** | `PHASE-03-authentication` | Implement merchant onboarding, AES-256-GCM credential encryption, JWT session auth, and tenant isolation guards (`WHERE merchant_id = :merchantId`). | Phase 02 |
| **Phase 04** | `PHASE-04-webhook-ingestion` | Implement NestJS raw body preservation (`rawBody: true`), constant-time HMAC SHA-256 validation (`crypto.timingSafeEqual`), duplicate check, and `WebhookEvent` persistence. | Phase 03 |
| **Phase 05** | `PHASE-05-async-processing` | Implement Redis 7 `@nestjs/bullmq` integration, queue module, background job producer/worker, 3-attempt exponential retries, and worker idempotency checks. | Phase 04 |
| **Phase 06** | `PHASE-06-payment-detection` | Implement failure detection (`payment.failed` $\rightarrow$ `FAILED_PAYMENT`) and degradation engine (`PaymentTelemetry` 1-hour window $\rightarrow$ `DEGRADATION`). | Phase 05 |
| **Phase 07** | `PHASE-07-diagnosis-and-erv` | Implement deterministic Razorpay error taxonomy diagnosis, recoverability classification, ERV formula calculation, and AI narrative fallback generator. | Phase 06 |
| **Phase 08** | `PHASE-08-recovery-opportunity` | Implement prioritization ranking engine, merchant policy gating (`maxRetryCount`, `minRecoveryAmount`), and 12-state canonical database transition engine. | Phase 07 |
| **Phase 09** | `PHASE-09-recovery-action` | Implement Razorpay API client, per-attempt `reference_id` (`opp_<id>_att_<n>`, $\le 40$ chars), structured `notes` metadata, Payment Link dispatch, and Test Mode UI URL rendering. | Phase 08 |
| **Phase 10** | `PHASE-10-payment-verification` | Implement verification engine for `payment_link.partially_paid` and `payment_link.paid`, `RecoveryPayment` payment-level idempotency, and minor unit integer paise ledger updates. | Phase 09 |
| **Phase 11** | `PHASE-11-dashboard` | Implement Control Tower REST APIs and React/Vite dashboard UI for Executive Summary (`Revenue at Risk`, `Verified Recovered`), Opportunity Queue, and Audit Log timeline. | Phase 10 |
| **Phase 12** | `PHASE-12-hardening-and-verification` | End-to-end sandbox verification in Razorpay Test Mode, load/stress testing, failure resilience testing, container optimization, and final production checklist. | Phase 11 |

---

## 5. Primary End-to-End Vertical Slice

The roadmap prioritizes establishing the primary executable vertical slice as early as Phase 10:

```text
Razorpay Failed Payment
       │
       ▼
Webhook Ingestion (HMAC Validated & Persisted as PENDING) ──► Phase 04
       │
       ▼
BullMQ Async Job Queue Dispatch ──► Phase 05
       │
       ▼
Payment Failure & Degradation Detection Engine ──► Phase 06
       │
       ▼
Root-Cause Diagnosis & ERV Calculation Engine ──► Phase 07
       │
       ▼
Prioritization & Merchant Policy Engine ──► Phase 08
       │
       ▼
Razorpay Recovery Action (Dynamic Payment Link Dispatch) ──► Phase 09
       │
       ▼
Razorpay Test-Mode Checkout & Payment Confirmation ──► Phase 09 / Phase 10
       │
       ▼
Financial Verification Engine & Partial Payment Ledger (Paise) ──► Phase 10
       │
       ▼
Control Tower Dashboard Metrics & Audit Timeline ──► Phase 11
```

---

## 6. Phase Completion Artifacts

Upon completing each implementation phase, the phase directory MUST contain:
```text
PHASE-XX-name/
├── PHASE.md
├── TESTING_STRATEGY.md
└── VERIFICATION_REPORT.md
```

---

## 7. Definition of "Implementation Complete"

The project is considered **Implementation Complete** when:
1. All 12 implementation phases have met their explicit **Definition of Done** and contain valid `TESTING_STRATEGY.md` and `VERIFICATION_REPORT.md` post-implementation artifacts.
2. The complete primary vertical slice executes cleanly end-to-end in Razorpay Test Mode (`rzp_test_...`).
3. Automated integration tests demonstrate:
   - HMAC signature forgery rejection (`HTTP 400`).
   - Concurrency-safe event deduplication via PostgreSQL composite `UNIQUE (provider, providerEventId)`.
   - BullMQ worker recovery across container restarts.
   - Payment-level financial idempotency via `RecoveryPayment` constraint (`UNIQUE (merchantId, razorpayPaymentId)`).
   - Zero integer minor-unit paise rounding or double-counting errors.
   - Core financial execution continuity during simulated AI/LLM service outages.
4. Single-command deployment (`docker compose up --build`) launches the complete application (NestJS, PostgreSQL, Redis) using `pnpm` with passing health checks.
