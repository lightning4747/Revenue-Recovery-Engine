# Phase 11 Testing Strategy: Control Tower Dashboard & Audit UI Subsystem

## Overview
This document details the testing methodology and suite organization for Phase 11: Control Tower Dashboard & Audit UI Subsystem. The testing matrix spans backend service unit tests, REST controller integration tests, end-to-end API verification, and React/Vite frontend production build validation.

---

## 1. Scope & Test Objectives
- **Control Tower Summary API (`DashboardService.getSummary`)**: Verify financial metric calculation formulas (`revenueAtRiskPaise = sum(remainingAmount)` for active opportunities, `verifiedRecoveredPaise = sum(recoveredAmount)` across all opportunities, `recoveryRatePercentage`).
- **Opportunity Queue API (`DashboardService.getOpportunities`)**: Verify tenant-isolated paginated query execution sorted by `priorityScore` DESC.
- **Audit Trail UI Endpoint (`DashboardService.getAuditTrail`)**: Verify retrieval of sanitized `userExplanation` narrative strings while strictly excluding internal technical JSON snapshots or credentials (MED-03).
- **Control Tower React Frontend Build (`apps/frontend/`)**: Verify production bundling of Executive Summary Cards, Opportunity Queue Table, Audit Timeline Modal, and Test Mode Launch Link button (HIGH-04).

---

## 2. Test Execution Commands

```bash
# Backend Unit Tests
pnpm --filter backend test src/dashboard/

# All Backend Unit Tests (29 test suites)
pnpm --filter backend test

# End-to-End REST Integration Suite (24 tests)
pnpm test:e2e

# Frontend Production Build Verification
pnpm --filter frontend build
```
