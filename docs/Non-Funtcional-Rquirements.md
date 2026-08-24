# NON_FUNCTIONAL_REQUIREMENTS.md

## 1. Purpose

This document defines the non-functional requirements for the **Revenue Recovery Engine (RRE)**.

RRE is intended to operate as an intelligence and prioritization layer around Razorpay's existing payment and recovery infrastructure. It must identify revenue at risk, diagnose likely causes, estimate recoverability, prioritize opportunities, execute bounded recovery actions, verify outcomes, and report actual recovered revenue.

The system is not successful merely because an AI model produces plausible recommendations. It must produce **correct, observable, auditable, and reproducible financial outcomes** through Razorpay's test-mode environment.

The requirements below are derived from the validated product requirements and Razorpay research. In particular, the research positions RRE as a master intelligence/prioritization layer rather than a replacement for Razorpay's specialized execution capabilities. 

---

# 2. NFR Objectives

RRE shall satisfy the following high-level properties:

1. Financial correctness
2. Reliability
3. Idempotent execution
4. Bounded autonomy
5. Auditability
6. Explainability
7. Security
8. Observability
9. Recoverability
10. Data consistency
11. Testability
12. Performance
13. Maintainability
14. Reproducibility

The most important principle is:

> **The system must never claim financial recovery unless the recovery has been independently verified from the resulting payment state.**

---

# 3. Financial Correctness

## NFR-FC-001 — Verified Revenue Only

RRE shall count revenue as **recovered** only after successful payment state verification.

An attempted recovery, API success response, generated payment link, scheduled retry, or AI recommendation shall not by itself constitute recovered revenue.

The system shall distinguish between:

* Revenue at risk
* Expected recoverable revenue
* Attempted recovery
* Verified recovered revenue
* Unresolved revenue

---

## NFR-FC-002 — No False Recovery Reporting

The system shall never increase the recovered-revenue metric solely because a recovery action was initiated.

A recovery shall require confirmation from the resulting Razorpay payment state or another authoritative transaction state.

This is particularly important because the research identifies successful payment events such as `payment.captured` / `payment_link.paid` as the basis for confirming successful recovery. 

---

## NFR-FC-003 — Monetary Precision

All monetary calculations shall avoid floating-point precision errors.

Amounts shall be represented using integer minor units wherever supported by the Razorpay API.

For example:

```text
₹1,250.50
        ↓
125050 minor units
```

The system shall use the merchant's configured currency when presenting monetary values.

---

## NFR-FC-004 — Immutable Financial Outcomes

Once a recovery outcome has been verified, the original financial outcome shall not be silently overwritten.

Corrections shall be represented as new state transitions or reconciliation events.

---

# 4. Reliability

## NFR-REL-001 — Event Reliability

RRE shall reliably process relevant Razorpay webhook events.

A temporary processing failure shall not permanently discard an event.

The system shall maintain sufficient state to retry failed event processing.

---

## NFR-REL-002 — Webhook Verification

Webhook authenticity shall be verified before an event is allowed to affect financial state.

Invalid or unverifiable events shall be rejected and recorded as security events.

---

## NFR-REL-003 — Duplicate Event Handling

RRE shall tolerate duplicate webhook delivery.

Processing the same event multiple times shall not:

* Create duplicate recovery opportunities.
* Increment retry counts multiple times.
* Execute duplicate recovery actions.
* Double-count recovered revenue.

---

## NFR-REL-004 — Out-of-Order Events

The system shall tolerate events arriving in an order different from the logical payment lifecycle.

The internal payment state shall not blindly transition based only on event arrival order.

Where necessary, the system shall reconcile the current state against the authoritative Razorpay API.

---

# 5. Idempotency

## NFR-ID-001 — Recovery Action Idempotency

Every externally executed recovery action shall have a unique idempotency/control identifier.

Repeated processing of the same recovery opportunity shall not result in unintended duplicate financial actions.

---

## NFR-ID-002 — State Transition Idempotency

Each opportunity transition shall be safe to retry.

For example:

```text
DETECTED
    ↓
DIAGNOSED
    ↓
PRIORITIZED
    ↓
APPROVED
    ↓
EXECUTED
    ↓
VERIFIED
```

Retrying a failed processing step shall not corrupt the opportunity state.

---

## NFR-ID-003 — Exactly-Once Financial Effect

The system should provide **at-most-once financial effect** for each recovery action even when internal event processing is retried.

Exactly-once event delivery shall not be assumed.

---

# 6. Bounded Autonomy

## NFR-BA-001 — Policy Enforcement

AI-generated actions shall always pass through deterministic merchant policy validation before execution.

The research explicitly identifies merchant recovery ceilings and platform guardrails as part of the intended RRE architecture. 

---

## NFR-BA-002 — Recovery Limits

The system shall enforce configurable limits including:

* Maximum retry count
* Minimum recovery amount
* Maximum recovery window
* Maximum automated action value
* Allowed recovery actions
* Customer-contact limits where applicable

---

## NFR-BA-003 — AI Cannot Override Policy

The AI decision layer shall never be capable of overriding deterministic safety policies.

A high-confidence model prediction must still fail execution if the corresponding action violates merchant policy.

---

## NFR-BA-004 — Human Approval

The system shall support human approval for actions configured as approval-required.

The system shall support at least:

```text
Recommendation
Approval required
Automatic execution
```

---

## NFR-BA-005 — Automatic Stopping

Recovery workflows shall terminate automatically when configured stopping conditions are reached.

Stopping conditions shall include:

* Successful recovery
* Maximum attempts reached
* Recovery window expired
* Policy violation
* Opportunity determined unrecoverable
* Merchant-disabled recovery

---

# 7. Explainability

## NFR-EX-001 — Decision Transparency

Every AI-generated recovery decision shall provide the factors that materially influenced the decision.

The explanation shall identify:

* Observed transaction information
* Relevant historical signals
* Detected cause
* Recovery probability
* Expected recovery
* Selected action
* Applicable policy constraints

---

## NFR-EX-002 — Fact vs Inference

The system shall clearly distinguish:

**Observed fact**

from

**AI inference**

and

**Estimated outcome**.

For example:

```text
Observed:
Payment failed with network_error.

Inference:
The failure appears potentially transient.

Estimate:
Recovery probability = 72%.

Decision:
Retry payment.

Outcome:
Payment subsequently captured.
```

---

## NFR-EX-003 — No Fabricated Reasoning

The system shall not present unsupported explanations as factual causes.

Where the cause cannot be confidently established, the system shall explicitly report uncertainty.

---

# 8. Auditability

## NFR-AUD-001 — Complete Audit Trail

Every revenue opportunity shall have a traceable history covering:

```text
Detection
→ Diagnosis
→ Recovery estimation
→ Prioritization
→ Policy evaluation
→ Approval
→ Action
→ API result
→ Verification
→ Final outcome
```

The research already identifies an immutable audit log as part of the proposed implementation model. 

---

## NFR-AUD-002 — Audit Integrity

Audit records shall not be silently modified or deleted through normal application operations.

Corrections shall create additional audit events.

---

## NFR-AUD-003 — Traceability

Every externally executed action shall be traceable to:

* Merchant
* Recovery opportunity
* Razorpay transaction/order/payment
* Internal action ID
* Policy evaluation
* Execution timestamp
* Result

---

## NFR-AUD-004 — Human-Readable Audit

The dashboard shall allow a merchant to understand why an action happened without requiring access to application logs.

---

# 9. Security

## NFR-SEC-001 — Credential Protection

Razorpay API credentials and webhook secrets shall never be exposed to the frontend.

Credentials shall be stored securely and accessed only by the backend integration layer.

---

## NFR-SEC-002 — Test/Production Isolation

The MVP shall operate exclusively against Razorpay test-mode credentials.

The application shall clearly identify its environment.

Production credentials shall not be accepted by the MVP unless explicitly enabled through a separate controlled deployment configuration.

---

## NFR-SEC-003 — Webhook Security

Webhook signatures shall be validated before processing.

Malformed, unsigned, or invalid events shall not modify financial state.

---

## NFR-SEC-004 — Sensitive Data Minimization

RRE shall store only the merchant/customer information required for its functionality.

Raw payment credentials or sensitive payment instrument information shall not be stored.

---

## NFR-SEC-005 — Authorization

Only authorized merchant users shall be able to:

* View financial data
* Change recovery policies
* Approve recovery actions
* Trigger manual recovery
* View audit information
* Modify integration settings

---

# 10. Data Consistency

## NFR-DC-001 — Razorpay as Payment Authority

Where there is disagreement between the internal RRE state and the authoritative Razorpay payment state, the Razorpay state shall be treated as authoritative for payment outcomes.

---

## NFR-DC-002 — Reconciliation

RRE shall support reconciliation between internally recorded opportunities and Razorpay transaction state.

The system shall identify:

* Missing transactions
* Missing events
* State mismatches
* Unverified recoveries
* Duplicate records

---

## NFR-DC-003 — Eventual Consistency

The system may operate with eventual consistency between webhook events, internal state, and Razorpay APIs.

The dashboard shall not imply real-time financial certainty when the underlying payment state is still pending.

---

# 11. Failure Handling

## NFR-FH-001 — Razorpay API Failure

A Razorpay API failure shall not cause the recovery opportunity to be incorrectly marked as recovered.

The system shall record the failure and determine whether retrying is permitted.

---

## NFR-FH-002 — Network Failure

Temporary network failures shall be retried where safe.

Retries shall use bounded exponential backoff.

The research identifies `network_error` and `server_error` as potentially recoverable conditions suitable for retry strategies. 

---

## NFR-FH-003 — Permanent Failure

The system shall distinguish transient failures from failures that should not be retried.

A permanent failure shall terminate or escalate the recovery workflow according to policy.

---

## NFR-FH-004 — Partial Failure

If an external action is initiated but its final state cannot immediately be determined, the opportunity shall enter a pending/verification state rather than being marked failed or recovered prematurely.

---

## NFR-FH-005 — Graceful Degradation

If AI services become unavailable, the core financial state and previously executed recovery actions shall remain accessible.

The system shall not lose transaction or audit information because the AI decision layer is temporarily unavailable.

---

# 12. Observability

## NFR-OBS-001 — System Health

The application shall expose sufficient operational information to determine:

* API health
* Webhook processing health
* Event processing failures
* Recovery execution failures
* AI service failures
* Database health
* Synchronization status

---

## NFR-OBS-002 — Business Metrics

The system shall expose business-level metrics including:

* Revenue at risk
* Expected recoverable revenue
* Actual recovered revenue
* Recovery attempts
* Successful recoveries
* Failed recoveries
* Recovery rate
* Unresolved revenue
* Recovery by opportunity category

---

## NFR-OBS-003 — Processing Metrics

The system shall measure:

* Webhook processing latency
* Detection latency
* Decision latency
* Recovery execution latency
* Verification latency
* End-to-end recovery latency

---

## NFR-OBS-004 — Dashboard Accuracy

Every financial metric displayed by the dashboard shall be derivable from persisted transaction/opportunity/outcome records.

Dashboard values shall not depend solely on transient AI output.

---

# 13. Performance

## NFR-PERF-001 — Event Processing

Normal webhook events should be processed quickly enough that newly detected revenue opportunities become visible in the dashboard without requiring manual refresh/synchronization.

The exact latency target shall be established during implementation based on the capabilities of the Razorpay test environment.

---

## NFR-PERF-002 — Dashboard Response

Normal dashboard operations should respond within an acceptable interactive time under the expected MVP workload.

Performance optimization shall prioritize correctness over premature optimization.

---

## NFR-PERF-003 — Batch Processing

The system shall be capable of processing a meaningful batch of transaction/revenue events for evaluation.

The system shall not rely on a manually curated handful of transactions to demonstrate recovery performance.

---

# 14. Testability

## NFR-TEST-001 — Reproducible Test Scenarios

The system shall support reproducible test-mode scenarios representing:

* Successful payment
* Failed payment
* Recoverable payment failure
* Repeated failure
* Recovery success
* Recovery failure
* Duplicate webhook
* Delayed webhook
* API failure
* Unverified recovery
* Recovery-policy violation

---

## NFR-TEST-002 — End-to-End Testing

The primary recovery workflow shall be testable from:

```text
Razorpay event
→ RRE detection
→ AI diagnosis
→ Recovery decision
→ Policy validation
→ Razorpay action
→ Razorpay state change
→ RRE verification
→ Dashboard metric
```

---

## NFR-TEST-003 — Batch Evaluation

The system shall support evaluation against a sufficiently large synthetic/test-mode batch.

The evaluation shall report both successful and unsuccessful cases.

---

## NFR-TEST-004 — Failure Testing

At least one externally failed recovery workflow shall be demonstrated and correctly represented in the system.

The system must prove that failure does not result in false recovered-revenue reporting.

---

# 15. Reproducibility

## NFR-REP-001 — Deterministic Policies

Merchant policies shall be deterministic and independently testable.

---

## NFR-REP-002 — Decision Records

The inputs used for an AI recovery decision shall be persisted sufficiently to reproduce or audit the decision later.

---

## NFR-REP-003 — Evaluation Dataset

The evaluation dataset used to measure recovery performance shall be preserved and versioned for comparison between system iterations.

---

# 16. Maintainability

## NFR-MNT-001 — Separation of Concerns

The implementation shall separate:

* Razorpay integration
* Event ingestion
* Revenue state
* Detection
* AI/ML inference
* Recovery prioritization
* Policy enforcement
* Action execution
* Outcome verification
* Audit logging
* Dashboard/API

Razorpay-specific API behavior shall not be tightly coupled to business logic.

---

## NFR-MNT-002 — Provider Abstraction

Razorpay API interactions shall be isolated behind an integration boundary so that recovery logic does not directly depend on low-level HTTP implementation details.

---

## NFR-MNT-003 — Explainable Failure

Application errors shall contain enough structured information to diagnose the failing subsystem without exposing secrets or sensitive information.

---

# 17. Scalability

## NFR-SCL-001 — Initial Scale

The architecture shall support the expected hackathon/demo workload without unnecessary distributed infrastructure.

The initial system should prioritize correctness and demonstrability over large-scale infrastructure.

---

## NFR-SCL-002 — Event Volume

The event-processing design should permit future scaling of webhook/event processing without requiring fundamental changes to the revenue-opportunity model.

---

# 18. Availability and Recovery

## NFR-AVL-001 — No Silent Data Loss

Temporary application downtime shall not result in silently lost financial events or recovery opportunities.

---

## NFR-AVL-002 — Recovery After Restart

After application restart, RRE shall be able to resume pending recovery opportunities and incomplete verification workflows from persisted state.

---

## NFR-AVL-003 — Recovery State Persistence

Recovery state shall not exist exclusively in application memory.

At minimum, the following shall be persisted:

* Opportunity state
* Retry count
* Recovery action state
* Verification state
* Audit events
* Merchant policy

The research's proposed state ledger follows this principle by persisting recovery opportunities and merchant policies rather than maintaining them only in memory. 

---

# 19. User Experience

## NFR-UX-001 — Financial Clarity

The dashboard shall prioritize:

**₹ at risk → ₹ expected to recover → ₹ actually recovered**

rather than emphasizing AI-generated scores.

---

## NFR-UX-002 — Action Transparency

For each automated action, the merchant shall be able to see:

* What happened
* Why it happened
* What action was taken
* Whether the action succeeded
* How much revenue was recovered
* Why the system stopped

---

## NFR-UX-003 — Real-Time Demonstrability

The application shall visibly reflect relevant changes resulting from Razorpay test-mode activity.

The intended demonstration should be possible through actual test transactions/events rather than mocked dashboard state.

---

# 20. Demo and Evaluation Requirements

These requirements are particularly important because the final application is expected to demonstrate real interaction with the Razorpay test environment.

## NFR-DEMO-001 — Real Test-Mode Integration

The primary demonstration shall use actual Razorpay test-mode APIs/events wherever the validated API surface supports the workflow.

Mocked transactions may be used for unsupported edge cases, but mocked results shall be clearly identified.

---

## NFR-DEMO-002 — End-to-End Visibility

A judge/user shall be able to observe the complete lifecycle:

```text
Razorpay Test Event
        ↓
RRE detects revenue risk
        ↓
Cause identified
        ↓
Recovery value calculated
        ↓
Opportunity prioritized
        ↓
Policy evaluated
        ↓
Recovery action executed
        ↓
Razorpay state changes
        ↓
RRE verifies outcome
        ↓
Dashboard updates
```

---

## NFR-DEMO-003 — Actual Financial Outcome

The final demonstration shall show an actual test-mode transaction outcome rather than merely showing an AI recommendation.

---

## NFR-DEMO-004 — Failure Demonstration

The system shall demonstrate at least one unsuccessful or unavailable recovery path and show that:

* The failure is recorded.
* The workflow does not incorrectly report recovery.
* The system applies its stopping/retry policy.
* The dashboard accurately reflects the outcome.

---

# 21. Requirement Priority

Requirements shall be prioritized as follows:

### P0 — Mandatory

* Financial correctness
* Razorpay test-mode integration
* Webhook verification
* Idempotency
* Recovery state persistence
* Bounded recovery actions
* Outcome verification
* Audit trail
* Actual recovered-revenue measurement
* End-to-end testability
* Failure handling

### P1 — Important

* Root-cause explainability
* Recovery prioritization transparency
* Reconciliation
* Operational observability
* Human approval
* Batch evaluation
* Recovery analytics

### P2 — Future

* Advanced forecasting
* Adaptive recovery policies
* Cross-merchant learning
* Advanced experimentation
* Large-scale event infrastructure
* Production-grade distributed processing

---

# 22. Non-Functional Acceptance Criteria

The system will satisfy the NFR baseline when the following can be demonstrated:

1. A Razorpay test-mode event reaches RRE.
2. RRE creates exactly one corresponding revenue opportunity.
3. The opportunity contains a traceable diagnosis and recovery estimate.
4. The recovery opportunity is prioritized using a documented decision process.
5. A recovery action cannot execute outside merchant-defined policy.
6. Duplicate events cannot cause duplicate recovery actions.
7. A failed API call does not produce false recovered revenue.
8. A successful recovery is counted only after payment-state verification.
9. The entire lifecycle is visible in the audit trail.
10. The dashboard shows revenue at risk, expected recovery, and verified recovery separately.
11. The system survives a restart without losing pending recovery state.
12. A meaningful batch can be evaluated with both successful and unsuccessful outcomes.
13. The final demo uses actual Razorpay test-mode interactions wherever supported.
14. No production credentials or real monetary transactions are required.

---

# 23. Core Quality Principle

The Revenue Recovery Engine shall optimize for **trustworthy recovery rather than aggressive automation**.

The system should prefer:

> **“I identified ₹1,00,000 at risk and verified ₹42,000 recovered.”**

over:

> **“I identified ₹1,00,000 at risk and predicted ₹70,000 recovery.”**

The first is a measurable financial outcome. The second is only a model claim.

For this project, **financial correctness, bounded autonomy, auditability, and verified recovery are higher-priority requirements than model sophistication.**
