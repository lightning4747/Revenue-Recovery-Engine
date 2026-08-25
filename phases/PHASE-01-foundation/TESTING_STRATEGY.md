# PHASE 01 — Testing Strategy

## 1. Overview
This testing strategy covers Phase 01 (Foundation & Infrastructure Setup). It validates environment configuration, global exception handling, response transformation, and endpoint availability.

## 2. Test Suites
- **Unit Tests**:
  - `apps/backend/src/common/config/env.validation.spec.ts`: Validates Joi schema enforcement on valid vs. missing environment variables.
  - `apps/backend/src/common/filters/global-exception.filter.spec.ts`: Validates exception handling and standard JSON envelope formatting.
  - `apps/backend/src/common/interceptors/transform.interceptor.spec.ts`: Validates response mapping to the `{ success: true, statusCode, data, timestamp }` envelope.
  - `apps/backend/src/health/health.controller.spec.ts`: Validates controller output and uptime metric calculation.

- **E2E Integration Tests**:
  - `apps/backend/test/app.e2e-spec.ts`: Validates `GET /health` HTTP endpoint availability and payload envelope formatting via Supertest.

## 3. Execution Commands
```bash
# Run unit tests
pnpm --filter backend test

# Run e2e tests
pnpm --filter backend test:e2e

# Run TypeScript build check
pnpm --filter backend build
```
