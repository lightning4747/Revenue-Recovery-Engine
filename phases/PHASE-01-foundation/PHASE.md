# PHASE 01 — Foundation & Infrastructure Setup

## 1. Purpose
Establish the foundational NestJS application structure, TypeScript compiler configurations, `pnpm` package manager configuration, environment variable validation schemas, structured application logging, global HTTP exception filters, standardized API response formatters, and Docker Compose baseline service orchestration (NestJS, PostgreSQL 15, Redis 7).

Setting up these foundational components before domain logic prevents architectural churn and ensures reproducible local development.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 5 (*Technology Strategy*): Architecture stack (NestJS, PostgreSQL 15, Redis 7, Docker Compose) and `pnpm` package management.
  * Section 6 (*Backend Module Architecture*): Module directory layout (`src/auth`, `src/events`, `src/revenue`, `src/recovery`, `src/audit`, `src/dashboard`).
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 1 (*Performance & Scalability*): Logging and response latency baseline.
  * Section 3 (*Maintainability & Deployment*): Docker containerization and environment configuration.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 1 (*Executive Summary*): Production-grade MVP simple microservice boundaries (`NestJS -> PostgreSQL -> Redis/BullMQ -> Docker Compose`).

---

## 3. Prerequisites / Dependencies
* None (Initial Phase).

---

## 4. Scope
* Initialize NestJS TypeScript application project configured for `pnpm`.
* Configure `dotenv` and `@nestjs/config` with strict Joi/Zod environment variable validation.
* Set up standard NestJS logger and Winston/Pino structured JSON logging adapter.
* Implement global HTTP Exception Filter and API Response Interceptor.
* Configure basic `docker-compose.yml` defining PostgreSQL 15 (`postgres:15-alpine`) and Redis 7 (`redis:7-alpine`) services.

---

## 5. Technical Implementation Requirements
1. **NestJS Application Setup with `pnpm`**:
   * Initialize project using `pnpm`: `pnpm init` and `pnpm add @nestjs/core @nestjs/common @nestjs/config`.
   * Configure `tsconfig.json` with strict type checking enabled.
   * Lockfile MUST be `pnpm-lock.yaml`.
2. **Environment Variable Validation**:
   * Define required environment variables (`PORT`, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `WEBHOOK_SECRET`, `JWT_SECRET`).
   * Add runtime validation schema using `@nestjs/config` and Joi.
3. **Structured Logging & Exception Handling**:
   * Implement custom Winston/Pino logger formatting logs as structured JSON (`timestamp`, `level`, `context`, `message`, `trace`).
   * Implement `GlobalExceptionFilter` formatting error responses into a consistent JSON envelope:
     ```json
     {
       "success": false,
       "statusCode": 400,
       "error": "Bad Request",
       "message": "Error details",
       "timestamp": "2026-08-25T14:00:00.000Z"
     }
     ```
4. **Docker Compose Base Setup**:
   * Create `docker-compose.yml` for local container orchestration.
   * Configure `postgres` service on port `5432` with persistent volume `postgres_data`.
   * Configure `redis` service on port `6379` with persistent volume `redis_data`.
   * Configure NestJS app service with health check endpoint (`GET /health`).

---

## 6. Files / Modules / Components Affected
```text
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── config/
│   │   └── env.validation.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   └── logger/
│       └── app-logger.service.ts
└── health/
    ├── health.controller.ts
    └── health.module.ts

docker-compose.yml
Dockerfile
pnpm-lock.yaml
.env.example
```

---

## 7. Interfaces / Data / Integration Requirements
* **API Endpoints**: `GET /health` (returns `{ status: "ok", uptime: 120 }`).
* **Database**: PostgreSQL 15 container initialized; no tables created yet.
* **Integrations**: Redis 7 container initialized; no queues attached yet.

---

## 8. Acceptance Criteria
* Running `pnpm run build` compiles cleanly without TypeScript warnings.
* Invalid `.env` variables cause application startup to fail with clear schema error messages.
* `GET /health` returns `200 OK` with JSON health payload.
* Unhandled application errors are caught by `GlobalExceptionFilter` and formatted cleanly without exposing stack traces in production mode.
* Running `docker compose up -d` successfully starts PostgreSQL and Redis containers with healthy statuses.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Environment variable schema validation on startup (valid vs. missing variables).
  * Global exception filter error response formatting.
  * Health check HTTP endpoint availability.
  * Docker Compose container health check statuses.
* **Verification Scope**: Unit tests for config validation and exception filters; integration HTTP test for `/health`.

---

## 10. Definition of Done
* Project builds cleanly via `pnpm`, unit/integration tests pass 100%, `/health` endpoint responds `200 OK`, and Docker Compose starts PostgreSQL and Redis containers cleanly.

---

## 11. Explicitly Out of Scope
* Database ORM entity mapping or migrations (handled in Phase 02).
* User session auth or merchant API key handling (handled in Phase 03).
* Razorpay Webhook signature verification or payload parsing (handled in Phase 04).
* BullMQ queue producer/processor configuration (handled in Phase 05).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
