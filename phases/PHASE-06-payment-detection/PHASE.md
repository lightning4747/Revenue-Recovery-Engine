# PHASE 06 — Failure & Degradation Detection Engine

## 1. Purpose
Implement the Failure Detection Module (`payment.failed` event parsing) and the Payment Degradation Telemetry Engine (rolling 1-hour window telemetry aggregation over `PaymentTelemetry` compared against `BankPerformanceBaseline` to trigger `DEGRADATION` opportunities).

Detection is the first domain stage in the RRE pipeline. It converts incoming Razorpay telemetry into internal `RecoveryOpportunity` business entities. Implementing both direct payment failure detection (FR-005) and bank degradation anomaly detection (FR-006, HIGH-02) ensures complete coverage for revenue loss detection.

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 7 (*FR-005 Failure Detection*): Parsing `payment.failed` webhooks to create `FAILED_PAYMENT` recovery opportunities.
  * Section 7 (*FR-006 Payment Degradation*): Aggregating rolling 1-hour bank success rates to detect performance drops $> 20\%$ below baseline.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 11.3 (*Payment Degradation Telemetry Models*): `PaymentTelemetry` and `BankPerformanceBaseline` entity schemas and `UNIQUE (merchantId, paymentMethod, bank)` index.
  * Section 12 (*Detection Layer & Degradation Anomaly Specification*): Telemetry ingestion rules, 1-hour rolling window calculation, and degradation anomaly threshold logic.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 2 & HIGH-02: Payment telemetry models and implementable degradation detection engine requirements.

---

## 3. Prerequisites / Dependencies
* **PHASE-02 (Database)**: Requires `RecoveryOpportunity`, `PaymentTelemetry`, and `BankPerformanceBaseline` database schemas.
* **PHASE-05 (Async Processing)**: Requires BullMQ background worker execution environment and `pnpm` package manager.

---

## 4. Scope
* Implement `DetectionModule` within the asynchronous event domain pipeline.
* **Payment Failure Detection (FR-005)**:
  * Parse `payment.failed` webhook payloads.
  * Extract `originalTransactionId` (`pay_...`), `originalOrderId` (`order_...`), `amount` (paise), customer contact info, and payment method/bank details.
  * Instantiate new `RecoveryOpportunity` with `sourceType = 'FAILED_PAYMENT'` and initial `status = 'OBSERVED'`.
* **Payment Degradation Telemetry Engine (FR-006, HIGH-02)**:
  * Ingest all payment attempts (success and failure) into `PaymentTelemetry` table.
  * Implement rolling 1-hour window aggregation background task (`WHERE timestamp >= NOW() - INTERVAL '1 hour'`).
  * Calculate `currentSuccessRate` per `(merchantId, paymentMethod, bank)`.
  * Update `BankPerformanceBaseline`.
  * Trigger `DEGRADATION` opportunity (`sourceType = 'DEGRADATION'`, initial `status = 'OBSERVED'`) if `sampleCount >= 10` and `currentSuccessRate < (baselineSuccessRate - 20.0)`.

---

## 5. Technical Implementation Requirements
1. **Telemetry Ingestion Service**:
   * Create `TelemetryService`: Ingests every incoming payment event payload into `PaymentTelemetry` table storing `merchantId`, `paymentMethod`, `bank`, `status`, `failureReason`, `amount`, and `timestamp`.
2. **Failed Payment Detection Service**:
   * Create `FailureDetectionService`:
     - Listens for `payment.failed` events.
     - Performs eligibility checks (e.g. amount $\ge$ minimum threshold).
     - Creates `RecoveryOpportunity` record with `sourceType: 'FAILED_PAYMENT'`, `status: 'OBSERVED'`, `amount` (in paise), `recoveredAmount: 0`, and `remainingAmount: amount`.
3. **Degradation Detection Engine**:
   * Create `DegradationDetectionService`:
     - Cron or periodic background task running every 5 minutes using `@nestjs/schedule` (added via `pnpm add @nestjs/schedule`).
     - Aggregates `PaymentTelemetry` over the trailing 1-hour window grouped by `(merchantId, paymentMethod, bank)`.
     - Compares `currentSuccessRate` against historical `baselineSuccessRate` stored in `BankPerformanceBaseline`.
     - If `currentSuccessRate < (baselineSuccessRate - 20.0)` and `sampleCount >= 10`, updates `degradationFlagged = true` and creates `RecoveryOpportunity` with `sourceType: 'DEGRADATION'`.

---

## 6. Files / Modules / Components Affected
```text
src/
└── revenue/
    └── detection/
        ├── detection.module.ts
        ├── detection.service.ts
        ├── failure-detection.service.ts
        ├── degradation-detection.service.ts
        └── telemetry.service.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **Database Updates**:
  * Inserts records into `payment_telemetry`.
  * Updates `bank_performance_baselines`.
  * Inserts new records into `recovery_opportunities` with initial state `status = 'OBSERVED'`.

---

## 8. Acceptance Criteria
* Receiving a `payment.failed` event creates a `RecoveryOpportunity` record (`status: 'OBSERVED'`, `sourceType: 'FAILED_PAYMENT'`).
* Telemetry records are saved for every payment event.
* Aggregating telemetry over a 1-hour window correctly calculates `currentSuccessRate`.
* Simulating a bank success rate drop from 90% to 60% flags `degradationFlagged = true` and creates a `DEGRADATION` `RecoveryOpportunity`.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * `payment.failed` event parsing and initial `RecoveryOpportunity` creation (`status: 'OBSERVED'`).
  * Telemetry record persistence for all payment attempts.
  * Rolling 1-hour window success rate aggregation math.
  * Degradation anomaly threshold detection (`sampleCount >= 10` and `drop > 20%`).
* **Verification Scope**: Unit tests for detection services; integration tests generating simulated bank failure streams.

---

## 10. Definition of Done
* Failure detection and rolling-window degradation engines operating cleanly, creating initial `RecoveryOpportunity` records (`status: 'OBSERVED'`), with passing automated tests executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* External analytics data warehouses or Kafka streaming pipelines.
* Root-cause classification or ERV formula evaluation (handled in Phase 07).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
