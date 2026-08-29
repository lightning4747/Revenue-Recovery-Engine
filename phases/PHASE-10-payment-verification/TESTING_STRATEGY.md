# Phase 10 Testing Strategy: Financial Verification & Partial Payment Ledger Engine

## Overview
This document outlines the testing strategy for verifying Phase 10: Financial Verification & Partial Payment Ledger Engine. The testing hierarchy covers unit testing of the outcome verification service, layer 3 payment-level financial idempotency, minor-unit integer ledger arithmetic, link expiration accounting, and end-to-end integration tests.

---

## 1. Scope & Test Objectives
- **Authoritative Webhook Processing (`OutcomeVerificationService`)**: Verify parsing of `payment_link.partially_paid`, `payment_link.paid`, `payment_link.expired`, and `payment_link.cancelled` webhook events, correlating payments to `RecoveryOpportunity` via `notes.opportunity_id` or `reference_id`.
- **Layer 3 Payment-Level Financial Idempotency (`LedgerTransactionService`)**: Verify unique payment constraint `(merchantId, razorpayPaymentId)` in `recovery_payments` table, blocking duplicate payment webhooks from double counting.
- **Transactional Minor-Unit Ledger Engine (`LedgerTransactionService`)**: Verify integer paise arithmetic ($\text{recoveredAmount} + \text{remainingAmount} == \text{amount}$), transitioning status $\rightarrow$ `'PARTIALLY_RECOVERED'` or `'RECOVERED'`.
- **Link Expiration Accounting (`OutcomeVerificationService`)**: Verify transition status $\rightarrow$ `'EXPIRED'` while preserving previously recovered revenue.
- **End-to-End Integration (`app.e2e-spec.ts`)**: Verify multi-step recovery flow (Failure $\rightarrow$ Action Dispatched $\rightarrow$ Partial Payment ₹1,000 $\rightarrow$ Duplicate Payment Webhook $\rightarrow$ Final Payment ₹1,500 $\rightarrow$ `RECOVERED`).

---

## 2. Test Execution Commands
```bash
# Unit Tests
pnpm --filter backend test src/recovery/verification/

# All Backend Unit Tests
pnpm --filter backend test

# End-to-End Integration Tests
pnpm test:e2e
```
