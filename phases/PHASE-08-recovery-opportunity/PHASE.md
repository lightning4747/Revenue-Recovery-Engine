# PHASE 08 — Prioritization, Policy Gating & Opportunity State Engine

## 1. Purpose
Implement the Prioritization Ranking Engine (computing Priority Score based on ERV and urgency), the Merchant Policy Gating Engine (enforcing `maxRetryCount`, `minRecoveryAmount`, and contact frequency limits), and the Canonical Opportunity State Machine Transition Engine managing transitions across the 12 canonical database states.

Not all revenue opportunities should be acted upon immediately. Ranking opportunities by expected yield (FR-014) ensures high-value recovery first. Evaluating merchant policy rules (FR-016) prevents illegal, excessive, or low-yield recovery outreach. Managing state transitions through a canonical database enum engine guarantees state machine integrity (HIGH-01).

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 9 (*FR-014 Prioritization Ranking*): Priority Score calculation based on ERV, LTV weight, and urgency.
  * Section 10 (*FR-015 Action Selection* & *FR-016 Policy Gating*): Policy validation against merchant threshold rules.
  * Section 11 (*FR-020 State Machine Persistence*): Opportunity state persistence across workflow.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 4 (*NFR-ID-002 State Transition Idempotency*): Concurrency-safe state transitions.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 10 (*Revenue State Machine* & *Section 10.1 Recovery State Transition Rules*): Single canonical 12-state database enum (`OBSERVED`, `AT_RISK`, `DIAGNOSED`, `VALUED`, `PRIORITIZED`, `ACTION_DISPATCHED`, `PARTIALLY_RECOVERED`, `RECOVERED`, `FAILED`, `EXPIRED`, `UNRECOVERABLE`, `POLICY_BLOCKED`) and transition rules.
  * Section 16 (*Prioritization Matrix*): Priority Score formula specifications.
  * Section 17 (*Recovery Policy Engine*): Policy rule gating logic.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 2 & HIGH-01: Canonical state machine standardization and transition matrix rules.

---

## 3. Prerequisites / Dependencies
* **PHASE-02 (Database)**: Requires `RecoveryOpportunity` and `MerchantPolicy` schemas.
* **PHASE-07 (Diagnosis & ERV)**: Requires opportunities in `VALUED` state and `pnpm` package manager.

---

## 4. Scope
* **Prioritization Ranking Engine (FR-014)**:
  * Compute `priorityScore`:
    $$\text{priorityScore} = ERV \times \text{urgencyMultiplier} \times \text{customerLtvWeight}$$
  * Transition opportunity `status` $\rightarrow$ `'PRIORITIZED'`.
* **Merchant Policy Engine (FR-016)**:
  * Load policy rules for target merchant (`maxRetryCount`, `minRecoveryAmount`, `autoExecutionEnabled`).
  * Check minimum recovery threshold: If `amount < minRecoveryAmount`, block action and transition `status` $\rightarrow$ `'POLICY_BLOCKED'`.
  * Check max retries: If `attemptCount >= maxRetryCount`, block action and transition `status` $\rightarrow$ `'POLICY_BLOCKED'`.
  * If policy approved and `autoExecutionEnabled == true`, authorize recovery action dispatch.
* **Canonical Opportunity State Engine (HIGH-01)**:
  * Enforce valid transitions across 12 canonical database states:
    `OBSERVED`, `AT_RISK`, `DIAGNOSED`, `VALUED`, `PRIORITIZED`, `ACTION_DISPATCHED`, `PARTIALLY_RECOVERED`, `RECOVERED`, `FAILED`, `EXPIRED`, `UNRECOVERABLE`, `POLICY_BLOCKED`.

---

## 5. Technical Implementation Requirements
1. **Prioritization Service**:
   * Create `PrioritizationService`:
     - Calculates `priorityScore`.
     - Updates `RecoveryOpportunity` with `priorityScore` and transitions `status` $\rightarrow$ `'PRIORITIZED'`.
2. **Merchant Policy Service**:
   * Create `PolicyEngineService`:
     ```typescript
     evaluatePolicy(opportunity: RecoveryOpportunity, policy: MerchantPolicy): PolicyEvaluationResult {
       if (opportunity.amount < policy.minRecoveryAmount) {
         return { approved: false, reason: 'AMOUNT_BELOW_MINIMUM' };
       }
       if (opportunity.attemptCount >= policy.maxRetryCount) {
         return { approved: false, reason: 'MAX_RETRIES_EXCEEDED' };
       }
       return { approved: true, reason: 'POLICY_APPROVED' };
     }
     ```
   * If policy rejected: Sets `status` $\rightarrow$ `'POLICY_BLOCKED'`, logs audit event, terminates action pipeline cleanly.
3. **State Machine Transition Service**:
   * Create `OpportunityStateMachineService`:
     - Enforces legal state transitions using an explicit transition matrix.
     - Logs an `AuditEvent` for every state change.

---

## 6. Files / Modules / Components Affected
```text
src/
└── recovery/
    ├── prioritization/
    │   ├── prioritization.module.ts
    │   └── prioritization.service.ts
    ├── policy/
    │   ├── policy.module.ts
    │   └── policy-engine.service.ts
    └── state/
        ├── opportunity-state-machine.service.ts
        └── state-transition.matrix.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **Database Updates**:
  * Updates `recovery_opportunities.priority_score`.
  * Transitions `recovery_opportunities.status` (`VALUED` $\rightarrow$ `PRIORITIZED` $\rightarrow$ `ACTION_DISPATCHED` or `POLICY_BLOCKED`).
  * Inserts record into `audit_events`.

---

## 8. Acceptance Criteria
* An opportunity with `amount = 500` paise (₹5.00) evaluated against a policy with `minRecoveryAmount = 10000` paise (₹100.00) transitions to `POLICY_BLOCKED`.
* An opportunity with `attemptCount = 3` evaluated against `maxRetryCount = 3` transitions to `POLICY_BLOCKED`.
* An approved opportunity transitions cleanly to `PRIORITIZED` and authorizes action dispatch.
* Attempting an invalid state transition (e.g. `OBSERVED` directly to `RECOVERED` without payment verification) throws an explicit `InvalidStateTransitionException`.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Priority Score computation logic accuracy.
  * Policy engine rule gating (`minRecoveryAmount` and `maxRetryCount` checks).
  * Canonical state machine transition matrix enforcement (blocking illegal transitions).
  * Audit logging for every state transition.
* **Verification Scope**: Unit tests for policy engine and state transition matrix; integration test for `VALUED` $\rightarrow$ `PRIORITIZED` $\rightarrow$ `POLICY_BLOCKED` / `ACTION_DISPATCHED`.

---

## 10. Definition of Done
* Prioritization ranking, merchant policy engine, and state transition matrix operational with passing automated tests executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* Complex credit risk scoring or external bureau API calls.
* Modifying state transition names outside the canonical 12-state enum.

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
