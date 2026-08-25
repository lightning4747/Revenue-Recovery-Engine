# PHASE 10 — Financial Verification & Partial Payment Ledger Engine

## 1. Purpose
Implement the Outcome Verification Engine processing `payment_link.partially_paid`, `payment_link.paid`, `payment_link.expired`, and `payment_link.cancelled` webhooks, enforce payment-level financial idempotency via `RecoveryPayment` (`UNIQUE (merchantId, razorpayPaymentId)`), and execute atomic minor-unit (paise) integer monetary ledger updates within PostgreSQL transactions (`SELECT ... FOR UPDATE`).

Financial accuracy is governing requirement NFR-FC-001. RRE must never record recovered revenue without authoritative payment confirmation from Razorpay. Supporting partial payments (`accept_partial: true`), payment-level idempotency to block duplicate webhooks (CRIT-04), integer minor-unit arithmetic (MED-01), and partial link expiration accounting completes the primary end-to-end recovery vertical slice.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 12 (*FR-021 Recovery Verification* & *FR-022 Revenue Recovered*): Authoritative payment verification, partial recovery classification (`PARTIALLY_RECOVERED`), and actual recovered revenue calculation.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 1 (*NFR-FC-001 Verified Revenue Only* & *NFR-FC-003 Minor Unit Monetary Precision*): Authoritative evidence mandate and integer minor-unit (paise) arithmetic.
  * Section 4 (*NFR-ID-003 At-most-once Financial Effect*): Payment-level financial idempotency.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 10.1 (*Recovery State Transition Rules*): Transitions for `PARTIALLY_RECOVERED`, `RECOVERED`, and `EXPIRED`.
  * Section 11.2 (*Core Revenue & Recovery Models*): `RecoveryPayment` schema and `UNIQUE (merchantId, razorpayPaymentId)` index.
  * Section 19 (*Recovery Verification*) & Section 19.1 (*Partial Payment & Financial Ledger Verification Specification*): PostgreSQL `SELECT FOR UPDATE` transaction flow, minor-unit ledger recalculation formulas, and link expiration accounting rules (CRIT-04 & MED-01).
* **[`RAZORPAY_CAPABILITY_MATRIX.md`](../../docs/RAZORPAY_CAPABILITY_MATRIX.md)**:
  * Webhook Event Capabilities (`payment_link.partially_paid`, `payment_link.paid`, `payment_link.expired`).
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 2 & CRIT-04, MED-01: Partial payment verification, payment-level idempotency, and minor-unit monetary precision.

---

## 3. Prerequisites / Dependencies
* **PHASE-02 (Database)**: Requires `RecoveryOpportunity` and `RecoveryPayment` database schemas.
* **PHASE-05 (Async Processing)**: Requires BullMQ background queue worker.
* **PHASE-09 (Recovery Action)**: Requires dispatched recovery opportunities in `ACTION_DISPATCHED` state and `pnpm` package manager.

---

## 4. Scope
* **Authoritative Webhook Event Handlers (CRIT-04)**:
  * `payment_link.partially_paid`: Partial payment captured (`amount_due > 0`).
  * `payment_link.paid`: Final balance payment captured (`amount_due == 0`).
  * `payment_link.expired` / `payment_link.cancelled`: Link expired or cancelled.
* **Layer 3 Payment-Level Financial Idempotency (CRIT-04)**:
  * Check `RecoveryPayment` table for `razorpayPaymentId == payload.payment.entity.id` (`pay_...`).
  * If match exists, log duplicate payment notice and terminate transaction (no double counting).
* **Transactional Ledger Update Execution**:
  * Execute inside PostgreSQL transaction (`SELECT ... FOR UPDATE` on `RecoveryOpportunity`):
    - Insert `RecoveryPayment` record (`razorpayPaymentId = payload.payment.entity.id`, `amount = payload.payment.entity.amount`).
    - Recalculate:
      $$\text{recoveredAmount}_{\text{new}} = \text{recoveredAmount}_{\text{old}} + \text{payload.payment.entity.amount}$$
      $$\text{remainingAmount}_{\text{new}} = \max(0, \text{amount} - \text{recoveredAmount}_{\text{new}})$$
    - Evaluate state transition:
      - If $\text{remainingAmount}_{\text{new}} == 0$: `status` $\rightarrow$ `'RECOVERED'`, `resolvedAt` = `now()`.
      - If $\text{remainingAmount}_{\text{new}} > 0$: `status` $\rightarrow$ `'PARTIALLY_RECOVERED'`.
* **Link Expiration Accounting**:
  * Upon `payment_link.expired` or `payment_link.cancelled`: Set `status` $\rightarrow$ `'EXPIRED'`, `resolvedAt` = `now()`. Previously collected `recoveredAmount` remains counted as verified recovered revenue.

---

## 5. Technical Implementation Requirements
1. **Outcome Verification Worker Service**:
   * Create `OutcomeVerificationService`:
     ```typescript
     async processPaymentWebhook(merchantId: string, eventType: string, payload: any) {
       const paymentEntity = payload.payment.entity;
       const linkEntity = payload.payment_link.entity;
       const razorpayPaymentId = paymentEntity.id;
       const capturedAmount = paymentEntity.amount; // Minor units (paise)
       
       // Tier 1 Opportunity Correlation
       const oppId = linkEntity.notes?.opportunity_id || linkEntity.reference_id;
       
       return await this.dataSource.transaction(async (manager) => {
         // Lock Opportunity Row
         const opp = await manager.findOne(RecoveryOpportunityEntity, {
           where: { id: oppId, merchantId },
           lock: { mode: 'pessimistic_write' },
         });
         if (!opp) return;

         // Payment Idempotency Check
         const existing = await manager.findOne(RecoveryPaymentEntity, {
           where: { merchantId, razorpayPaymentId },
         });
         if (existing) return; // Duplicate payment webhook

         // Save RecoveryPayment
         await manager.save(RecoveryPaymentEntity, {
           merchantId,
           opportunityId: opp.id,
           paymentLinkId: linkEntity.id,
           razorpayPaymentId,
           amount: capturedAmount,
           status: 'CAPTURED',
         });

         // Recalculate Ledger
         opp.recoveredAmount += capturedAmount;
         opp.remainingAmount = Math.max(0, opp.amount - opp.recoveredAmount);

         if (opp.remainingAmount === 0) {
           opp.status = OpportunityStatus.RECOVERED;
           opp.resolvedAt = new Date();
         } else {
           opp.status = OpportunityStatus.PARTIALLY_RECOVERED;
         }

         await manager.save(opp);
         await this.auditService.log(manager, opp.id, 'PAYMENT_VERIFIED', opp.status);
       });
     }
     ```
2. **Expiration Worker Handler**:
   * Implement link expiration logic setting `status = 'EXPIRED'` while leaving `recoveredAmount` intact.

---

## 6. Files / Modules / Components Affected
```text
apps/backend/src/
└── recovery/
    └── verification/
        ├── verification.module.ts
        ├── verification.service.ts
        └── ledger-transaction.service.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **Database Updates**:
  * Inserts records into `recovery_payments` (`UNIQUE (merchant_id, razorpay_payment_id)`).
  * Updates `recovery_opportunities` (`recovered_amount`, `remaining_amount`, `status`, `resolved_at`).
  * Inserts audit records into `audit_events`.

---

## 8. Acceptance Criteria
* Receiving `payment_link.partially_paid` for ₹2,000 against a ₹10,000 opportunity updates `recoveredAmount` to 200,000 paise, `remainingAmount` to 800,000 paise, and `status` to `PARTIALLY_RECOVERED`.
* Receiving duplicate webhooks for the exact same `razorpayPaymentId` skips ledger recalculation, preventing revenue double counting.
* Receiving final `payment_link.paid` for the remaining ₹8,000 updates `remainingAmount` to 0 paise and `status` to `RECOVERED`.
* Webhook `payment_link.expired` sets `status` to `EXPIRED` while keeping previously recovered 200,000 paise in verified recovered revenue.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * `payment_link.partially_paid` and `payment_link.paid` webhook parsing.
  * Payment-level idempotency (`RecoveryPayment` duplicate key rejection).
  * PostgreSQL `SELECT FOR UPDATE` pessimistic row locking.
  * Minor-unit integer paise ledger arithmetic (`recoveredAmount + remainingAmount == amount`).
  * Partial link expiration accounting.
* **Verification Scope**: Unit tests for verification service; integration test simulating multi-step recovery trace (₹10,000 total $\rightarrow$ ₹2,000 partial payment $\rightarrow$ duplicate webhook $\rightarrow$ ₹8,000 final payment).

---

## 10. Definition of Done
* Financial outcome verification engine operational, processing partial payments, maintaining integer paise ledgers, blocking duplicate payment webhooks, and passing full vertical slice test suite executed via `pnpm`.

---

## 11. Explicit Out-of-Scope Items
* Automated bank refund processing or manual ledger adjustments.

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
