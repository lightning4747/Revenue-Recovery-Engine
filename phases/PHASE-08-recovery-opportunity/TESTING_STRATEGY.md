# Phase 08 Testing Strategy: Prioritization, Policy Gating & Opportunity State Engine

## Overview
This document outlines the testing strategy for verifying Phase 08: Prioritization, Policy Gating & Opportunity State Engine. The testing hierarchy covers unit testing of the canonical state transition matrix, priority score computation, merchant policy gating rules, and end-to-end integration tests.

---

## 1. Scope & Test Objectives
- **Canonical State Machine Matrix (`OpportunityStateMachineService` & `StateTransitionMatrix`)**: Verify explicit transition rules across 12 database states (`OBSERVED`, `AT_RISK`, `DIAGNOSED`, `VALUED`, `PRIORITIZED`, `ACTION_DISPATCHED`, `PARTIALLY_RECOVERED`, `RECOVERED`, `FAILED`, `EXPIRED`, `UNRECOVERABLE`, `POLICY_BLOCKED`), throwing `InvalidStateTransitionException` on illegal transitions and inserting audit events into `audit_events`.
- **Prioritization Engine (`PrioritizationService`)**: Verify priority score calculation ($\text{priorityScore} = ERV \times \text{urgencyMultiplier} \times \text{customerLtvWeight}$) and transition `'VALUED'` $\rightarrow$ `'PRIORITIZED'`.
- **Merchant Policy Engine (`PolicyEngineService`)**: Verify rule gating (`minRecoveryAmount`, `maxRetryCount`, `autoExecutionEnabled`), transitioning approved opportunities to `'ACTION_DISPATCHED'` and low-value/exhausted opportunities to `'POLICY_BLOCKED'`.
- **End-to-End Integration (`app.e2e-spec.ts`)**: Verify seamless status transition from webhook ingestion through diagnosis, valuation, prioritization, and policy gating in PostgreSQL.

---

## 2. Test Execution Commands
```bash
# Unit Tests
pnpm --filter backend test src/recovery/state/
pnpm --filter backend test src/recovery/prioritization/
pnpm --filter backend test src/recovery/policy/

# All Backend Unit Tests
pnpm --filter backend test

# End-to-End Integration Tests
pnpm test:e2e
```
