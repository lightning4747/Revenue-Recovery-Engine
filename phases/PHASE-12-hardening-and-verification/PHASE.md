# PHASE 12 — End-to-End System Hardening, Integration Verification & Dockerization

## 1. Purpose
Execute comprehensive end-to-end integration testing against Razorpay Test Mode APIs (`rzp_test_...`), perform failure resilience and idempotency verification, optimize production Docker Compose build configurations using `pnpm`, and complete the final pre-deployment readiness verification checklist.

A production-grade microservice MVP must be verified end-to-end under real sandbox conditions before release. Validating signature forgery rejection, BullMQ queue worker crash recovery, payment double-counting prevention, AI outage continuity, and single-command Docker deployment guarantees operational reliability.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 1 (*Performance & Latency*), Section 2 (*Security & Encryption*), Section 3 (*Reliability, Job Durability & Deployment*).
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 5 (*Technology Strategy*): Multi-stage Docker deployment, PostgreSQL 15, and Redis 7 configuration using `pnpm`.
  * Section 24 (*Database Strategy & Production Deployment*): Production containerization rules.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 10 (*Testing Feasibility*) & Section 14 (*Final Implementation Readiness Assessment*): End-to-end sandbox verification and container deployment readiness checklist.

---

## 3. Prerequisites / Dependencies
* **PHASE-01 through PHASE-11**: Requires complete implementation of all backend modules, databases, workers, actions, verification engines, and dashboard UI with `pnpm` package management.

---

## 4. Scope
* **End-to-End Sandbox Testing (Razorpay Test Mode)**:
  * Complete vertical slice execution: Simulated payment failure $\rightarrow$ webhook ingestion $\rightarrow$ BullMQ processing $\rightarrow$ diagnosis $\rightarrow$ ERV $\rightarrow$ policy approval $\rightarrow$ Payment Link dispatch $\rightarrow$ sandbox test payment $\rightarrow$ partial/full payment webhook $\rightarrow$ verified recovered revenue metric update.
* **Failure Resilience & Idempotency Hardening**:
  * Verify signature forgery rejection (`HTTP 400`).
  * Verify duplicate webhook re-transmission deduplication (`UNIQUE (provider, providerEventId)`).
  * Verify worker restart resilience (killing worker container mid-job).
  * Verify duplicate payment webhook rejection (`UNIQUE (merchantId, razorpayPaymentId)`).
  * Verify AI service outage continuity (simulated LLM 500 error $\rightarrow$ fallback template execution).
* **Containerization & Docker Compose Optimization**:
  * Build multi-stage production Dockerfile (`node:18-alpine`) using `pnpm`.
  * Optimize `docker-compose.yml` with health checks, container restart policies, and volume mounts.
  * Verify single-command deployment (`docker compose up --build`).

---

## 5. Technical Implementation Requirements
1. **End-to-End Sandbox Verification Suite**:
   * Create `test/e2e/vertical-slice.e2e-spec.ts`:
     - Runs complete scenario against live Razorpay Test Mode credentials (`rzp_test_...`).
     - Triggers `payment.failed` webhook.
     - Waits for BullMQ worker to process event and create Payment Link (`plink_...`).
     - Simulates test payment on Razorpay sandbox checkout.
     - Sends `payment_link.paid` webhook.
     - Verifies opportunity status transitions to `RECOVERED` and `recoveredAmount` matches payment.
2. **Stress & Resiliency Verification**:
   * Run concurrent duplicate webhook generator script (sending 50 identical webhooks simultaneously).
   * Verify exactly 1 `WebhookEvent` and 1 `RecoveryPayment` record exist in PostgreSQL.
3. **Production Dockerization with `pnpm`**:
   * Create multi-stage `Dockerfile`:
     ```dockerfile
     # Build stage
     FROM node:18-alpine AS builder
     WORKDIR /app
     RUN corepack enable && corepack prepare pnpm@latest --activate
     COPY package*.json pnpm-lock.yaml ./
     RUN pnpm install --frozen-lockfile
     COPY . .
     RUN pnpm run build

     # Production stage
     FROM node:18-alpine AS runner
     WORKDIR /app
     RUN corepack enable && corepack prepare pnpm@latest --activate
     COPY package*.json pnpm-lock.yaml ./
     RUN pnpm install --prod --frozen-lockfile
     COPY --from=builder /app/dist ./dist
     EXPOSE 3000
     CMD ["node", "dist/main.js"]
     ```
   * Configure `docker-compose.yml`:
     - Services: `app` (NestJS), `postgres` (PostgreSQL 15), `redis` (Redis 7).
     - Health checks: NestJS (`/health`), Postgres (`pg_isready`), Redis (`redis-cli ping`).

---

## 6. Files / Modules / Components Affected
```text
test/
└── e2e/
    ├── vertical-slice.e2e-spec.ts
    ├── idempotency.e2e-spec.ts
    └── resilience.e2e-spec.ts

Dockerfile
docker-compose.yml
docker-compose.override.yml
pnpm-lock.yaml
```

---

## 7. Interfaces / Data / Integration Requirements
* **Verification Targets**: Complete application stack (NestJS, PostgreSQL 15, Redis 7).
* **Environment Verification**: Evaluated under production environment configuration.

---

## 8. Acceptance Criteria
* `docker compose up --build` compiles NestJS production bundle via `pnpm`, initializes PostgreSQL database, runs migrations up, starts Redis 7, and passes all container health checks cleanly within 60 seconds.
* End-to-end sandbox test passes 100%, completing a full recovery lifecycle from `payment.failed` to `RECOVERED`.
* Submitting 50 concurrent duplicate webhooks creates exactly 1 database record without deadlocks or double-counting.
* Killing NestJS application container during active queue processing and restarting results in BullMQ picking up the job and completing it cleanly.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Full primary vertical slice sandbox execution.
  * Signature forgery rejection (`HTTP 400`).
  * Webhook deduplication (`UNIQUE (provider, providerEventId)`).
  * Worker restart crash recovery.
  * Payment double-counting prevention (`UNIQUE (merchantId, razorpayPaymentId)`).
  * AI service outage fallback continuity.
  * Multi-stage Docker build and Docker Compose startup.
* **Verification Scope**: Automated E2E test suite and container deployment check.

---

## 10. Definition of Done
* All end-to-end sandbox tests passing, resiliency tests passing, production multi-stage Docker build using `pnpm` optimized, and single-command deployment fully operational.

---

## 11. Explicitly Out of Scope
* Multi-region Kubernetes deployments or cloud load balancers.
* Penetration testing against live production Razorpay webhooks outside sandbox environment.

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
