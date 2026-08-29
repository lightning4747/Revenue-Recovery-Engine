# Phase 07 Testing Strategy: Root-Cause Diagnosis & ERV Calculation Engine

## Overview
This document outlines the testing strategy for verifying Phase 07: Root-Cause Diagnosis & ERV Calculation Engine. The testing hierarchy covers unit testing of taxonomy mapping, status transitions, integer paise valuation, 3000ms LLM timeout budget enforcement, and end-to-end integration tests.

---

## 1. Scope & Test Objectives
- **Taxonomy Mapping (`TaxonomyMapper`)**: Verify deterministic classification of Razorpay error taxonomy fields into cause categories, recoverability classes (`TEMPORARY`, `CUSTOMER_ACTION_REQUIRED`, `BANK_GATEWAY_FAILURE`, `UNRECOVERABLE`, `UNKNOWN`), recovery probabilities ($P_{\text{success}}$), and confidence scores.
- **Diagnosis Engine (`DiagnosisService`)**: Verify state transitions of `RecoveryOpportunity` records from `'OBSERVED'` to `'DIAGNOSED'` (or `'UNRECOVERABLE'`).
- **Valuation Engine (`ValuationService`)**: Verify calculation of Expected Recoverable Value ($ERV = \text{round}(amount \times P_{\text{success}})$ in integer paise) and estimated intervention costs, transitioning status to `'VALUED'`.
- **AI Advisory & Fallback Generator (`AiExplanationService`)**: Verify **3000ms LLM timeout budget** and deterministic fallback template execution when API keys are missing, requests time out, or API errors occur (HIGH-03).
- **End-to-End Integration (`app.e2e-spec.ts`)**: Verify seamless status transition from webhook ingestion through diagnosis and valuation in PostgreSQL.

---

## 2. Test Execution Commands
```bash
# Unit Tests
pnpm --filter backend test src/revenue/diagnosis/
pnpm --filter backend test src/revenue/valuation/
pnpm --filter backend test src/revenue/ai/

# All Backend Unit Tests
pnpm --filter backend test

# End-to-End Integration Tests
pnpm test:e2e
```
