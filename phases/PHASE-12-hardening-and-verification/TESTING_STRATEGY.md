# Phase 12 Testing Strategy: End-to-End System Hardening, Integration Verification & Dockerization

## Overview
This document outlines the testing strategy for Phase 12: End-to-End System Hardening, Integration Verification & Dockerization. The hardening hierarchy covers vertical slice sandbox execution, 3-tier financial idempotency stress testing, fault tolerance & AI outage fallback continuity, and production Docker container health validation.

---

## 1. Scope & Test Objectives
- **Full Primary Vertical Slice Sandbox Suite (`test/e2e/vertical-slice.e2e-spec.ts`)**: Verify complete end-to-end recovery lifecycle from payment failure ingestion (`payment.failed`) $\rightarrow$ BullMQ processing $\rightarrow$ diagnosis $\rightarrow$ ERV valuation $\rightarrow$ policy approval $\rightarrow$ payment link dispatch $\rightarrow$ payment link payment (`payment_link.paid`) $\rightarrow$ status transition to `RECOVERED` with verified revenue.
- **3-Tier Idempotency Hardening Suite (`test/e2e/idempotency.e2e-spec.ts`)**: Verify deduplication across Layer 1 (`webhook_events`), Layer 2 (`recovery_opportunities`), and Layer 3 (`recovery_payments`), ensuring duplicate webhooks return HTTP 200 without double counting or database deadlocks.
- **Resilience & Fault Tolerance Suite (`test/e2e/resilience.e2e-spec.ts`)**: Verify signature forgery rejection (`HTTP 400`) and AI outage fallback template execution (`AiExplanationService`).
- **Production Container Deployment**: Verify multi-stage Docker build using `pnpm` and Docker Compose health checks (`/health`, `pg_isready`, `redis-cli ping`).

---

## 2. Test Execution Commands

```bash
# All Backend Unit Tests (29 Test Suites)
pnpm --filter backend test

# All End-to-End Hardening & Integration Tests (4 Test Suites, 28 Tests)
pnpm test:e2e

# Frontend Production Build Verification
pnpm --filter frontend build

# Docker Compose Production Build & Launch
docker compose up -d --build
```
