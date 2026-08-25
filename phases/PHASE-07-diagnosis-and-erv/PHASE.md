# PHASE 07 — Root-Cause Diagnosis & ERV Calculation Engine

## 1. Purpose
Implement the Root-Cause Diagnosis Engine (mapping Razorpay error taxonomy `source`, `step`, `reason` to normalized cause classifications), the Expected Recoverable Value (ERV) Valuation Engine ($ERV = P_{\text{success}} \times \text{Amount}$), and the Advisory AI Explanation & Fallback Generator with a 3000ms LLM timeout budget.

A core value proposition of RRE is intelligent failure diagnosis and financial quantification. Deterministically mapping failure causes and calculating financial ERV prior to action dispatch guarantees financial rigor. Restricting AI to asynchronous narrative explanation with deterministic fallback templates (HIGH-03) ensures failure resilience (NFR-FH-005).

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 8 (*FR-010 Root Cause Diagnosis* & *FR-011 Confidence Scoring*): Error taxonomy mapping and recoverability classification.
  * Section 9 (*FR-012 Risk Quantification* & *FR-013 ERV Calculation*): Expected Recoverable Value formula calculation ($ERV = P_{\text{success}} \times \text{Amount}$).
  * Section 16 (*FR-029 Explainability*): Human-readable root cause explanation generation.
* **[`NON_FUNCTIONAL_REQUIREMENTS.md`](../../docs/NON_FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 3 (*NFR-FH-005 AI Service Outage Continuity*): Core financial processing must proceed cleanly during AI service outages.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 13 (*Root Cause Diagnosis*): Razorpay error taxonomy mapping and recoverability classes (`TEMPORARY`, `CUSTOMER_ACTION_REQUIRED`, `PAYMENT_INSTRUMENT_INVALID`, `BANK_GATEWAY_FAILURE`, `UNRECOVERABLE`).
  * Section 14 (*AI Responsibility & Fallback Architecture*): Deterministic system primacy, advisory AI role, 3000ms LLM timeout budget, and deterministic fallback explanation template (HIGH-03).
  * Section 15 (*Expected Recoverable Value*): ERV formula specification.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 2 & HIGH-03: AI advisory boundary and deterministic guardrail rules.

---

## 3. Prerequisites / Dependencies
* **PHASE-02 (Database)**: Requires `RecoveryOpportunity` schema.
* **PHASE-06 (Detection)**: Requires `RecoveryOpportunity` records in `OBSERVED` state and `pnpm` package manager.

---

## 4. Scope
* **Deterministic Root-Cause Diagnosis (FR-010, FR-011)**:
  * Map Razorpay error taxonomy fields (`source`, `step`, `reason`) to internal cause classifications (`CUSTOMER_AUTH_TIMEOUT`, `INSUFFICIENT_FUNDS`, `BANK_TECHNICAL_OUTAGE`, `NETWORK_TIMEOUT`, `CARD_INVALID`, etc.).
  * Assign recoverability class (`TEMPORARY`, `CUSTOMER_ACTION_REQUIRED`, `PAYMENT_INSTRUMENT_INVALID`, `BANK_GATEWAY_FAILURE`, `UNRECOVERABLE`).
  * Assign deterministic recovery probability ($P_{\text{success}}$: $0.00$ to $1.00$) and confidence score ($0.00$ to $1.00$).
  * Update opportunity `status` $\rightarrow$ `'DIAGNOSED'`.
* **Expected Recoverable Value Valuation Engine (FR-012, FR-013)**:
  * Compute $ERV = \text{round}(P_{\text{success}} \times \text{amount})$ in integer paise.
  * Update opportunity `status` $\rightarrow$ `'VALUED'`.
* **Advisory AI Explanation & Fallback Generator (HIGH-03, FR-029)**:
  * Asynchronously invoke LLM service (Google Gemini / OpenAI) to generate human-readable narrative explanations.
  * Impose strict 3000ms timeout budget.
  * On timeout, 5xx error, or low confidence ($< 0.60$), invoke **Deterministic Fallback Generator**:
    `"Payment failure classified as {cause} based on Razorpay error taxonomy (source: {source}, reason: {reason}). Action authorized per merchant policy rules."`

---

## 5. Technical Implementation Requirements
1. **Deterministic Diagnosis Service**:
   * Create `DiagnosisService`:
     ```typescript
     diagnose(source: string, step: string, reason: string): DiagnosisResult {
       if (source === 'customer' && reason === 'invalid_otp') {
         return { cause: 'CUSTOMER_AUTH_TIMEOUT', class: 'TEMPORARY', probability: 0.75, confidence: 0.95 };
       }
       if (source === 'bank' && reason === 'insufficient_funds') {
         return { cause: 'INSUFFICIENT_FUNDS', class: 'CUSTOMER_ACTION_REQUIRED', probability: 0.60, confidence: 0.90 };
       }
       if (reason === 'expired_card' || reason === 'card_invalid') {
         return { cause: 'CARD_INVALID', class: 'UNRECOVERABLE', probability: 0.00, confidence: 0.99 };
       }
       return { cause: 'UNKNOWN_LEAKAGE', class: 'UNKNOWN', probability: 0.30, confidence: 0.50 };
     }
     ```
   * Updates `RecoveryOpportunity` with `cause`, `causeConfidence`, `recoveryProbability`, and sets `status` $\rightarrow$ `'DIAGNOSED'`. If classified as `UNRECOVERABLE`, sets `status` $\rightarrow$ `'UNRECOVERABLE'`.
2. **Valuation Service (ERV Calculation)**:
   * Create `ValuationService`:
     - Calculates $ERV = \text{Math.round}(\text{amount} \times P_{\text{success}})$ in integer paise.
     - Calculates intervention cost estimate (paise).
     - Updates `RecoveryOpportunity` with `expectedRecoveryValue` and sets `status` $\rightarrow$ `'VALUED'`.
3. **Advisory AI Explanation & Fallback Generator**:
   * Create `AiExplanationService` using `@google/genai` or `@langchain/core` (installed via `pnpm add @google/genai`):
     - Calls LLM API with a 3000ms Promise timeout wrapper.
     - If LLM call succeeds, returns generated narrative explanation string.
     - If LLM call times out or throws error, logs warning and returns deterministic fallback narrative string:
       `"Payment failure classified as CUSTOMER_AUTH_TIMEOUT based on Razorpay error taxonomy (source: customer, reason: invalid_otp). Action authorized per merchant policy rules."`

---

## 6. Files / Modules / Components Affected
```text
apps/backend/src/
└── revenue/
    ├── diagnosis/
    │   ├── diagnosis.module.ts
    │   ├── diagnosis.service.ts
    │   └── taxonomy.mapper.ts
    ├── valuation/
    │   ├── valuation.module.ts
    │   └── valuation.service.ts
    └── ai/
        ├── ai-explanation.module.ts
        ├── ai-explanation.service.ts
        └── fallback-template.generator.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **Database Updates**:
  * Updates `recovery_opportunities` fields: `cause`, `cause_confidence`, `recovery_probability`, `expected_recovery_value`, and transitions `status` from `OBSERVED` $\rightarrow$ `DIAGNOSED` $\rightarrow$ `VALUED`.

---

## 8. Acceptance Criteria
* Razorpay error `(customer, payment_authentication, invalid_otp)` is deterministically diagnosed as `CUSTOMER_AUTH_TIMEOUT` with probability `0.75`.
* For an opportunity with `amount = 1000000` paise (₹10,000) and $P_{\text{success}} = 0.75$, $ERV$ is calculated as `750000` paise (₹7,500).
* An unrecoverable error (`expired_card`) sets `status` $\rightarrow$ `'UNRECOVERABLE'`.
* Simulating an LLM API timeout (>3000ms) triggers the fallback generator cleanly, returning a valid narrative string without crashing or delaying opportunity state transitions.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Deterministic taxonomy mapping accuracy for all Razorpay error codes.
  * Integer minor-unit ERV formula calculation precision ($ERV = P_{\text{success}} \times \text{Amount}$).
  * Automatic transition to `UNRECOVERABLE` for invalid instruments.
  * 3000ms LLM timeout budget enforcement and fallback template generation.
* **Verification Scope**: Unit tests for taxonomy mapper, valuation service, and AI fallback generator; integration test for `OBSERVED` $\rightarrow$ `DIAGNOSED` $\rightarrow$ `VALUED`.

---

## 10. Definition of Done
* Deterministic diagnosis, ERV calculation, and AI timeout fallback generator operational with passing unit/integration tests executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* Synchronous LLM execution blocking state machine.
* Multi-agent LLM systems or external prompt engineering frameworks.

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
