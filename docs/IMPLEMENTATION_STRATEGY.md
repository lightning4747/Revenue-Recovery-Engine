# IMPLEMENTATION_STRATEGY.md

## 1. Purpose

This document defines the implementation strategy for the **Revenue Recovery Engine (RRE)**.

RRE is implemented as a **revenue-recovery intelligence and prioritization layer** around Razorpay's existing payment infrastructure. It is not intended to replace Razorpay's payment processing, subscription retry infrastructure, or specialized recovery agents.

The research identifies the primary opportunity as a unified layer that evaluates revenue opportunities across workflows, calculates expected recoverable value, determines the appropriate recovery action, and measures the resulting financial outcome. 

The implementation must therefore optimize for one demonstrable outcome:

> **A real Razorpay test-mode transaction enters the RRE pipeline, produces a recovery opportunity, receives an explainable and bounded decision, triggers a real supported Razorpay action, produces a real resulting payment state, and is reflected as verified revenue in the dashboard.**

---

# 2. Implementation Principles

The implementation shall follow these principles.

### 2.1 Razorpay remains the source of truth for payments

RRE maintains its own analytical and recovery state, but Razorpay remains authoritative for payment outcomes.

RRE must never manufacture payment state from its own assumptions.

### 2.2 Intelligence is separated from execution

RRE determines:

* What is happening?
* Why is it happening?
* How much revenue is at risk?
* How recoverable is it?
* Which opportunity matters most?
* Which action should be attempted?

Razorpay APIs remain the execution surface.

This follows the research positioning of RRE as the intelligence/prioritization layer rather than another execution agent. 

### 2.3 Deterministic controls surround AI

AI may recommend a recovery action, but deterministic policy validation decides whether that action is allowed.

### 2.4 Events drive state; APIs verify state

Webhooks should drive near-real-time state transitions.

Razorpay API reads should be used where authoritative state must be confirmed or reconciled.

### 2.5 Recovery is not complete until verified

A recovery action is an attempt.

A successful Razorpay payment state is the outcome.

Only the latter contributes to verified recovered revenue.

### 2.6 Build around validated capabilities

The implementation shall prioritize Razorpay capabilities already validated against the test account.

Capabilities that are merely documented or inferred shall not become hard dependencies until independently validated.

---

# 3. Target System Boundary

The system boundary is:

```text
                     RAZORPAY
              Test APIs + Webhooks
                       │
                       │
                       ▼
              ┌──────────────────┐
              │ RRE Integration  │
              │ Layer            │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Revenue State    │
              │ & Event Engine   │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Detection &      │
              │ Diagnosis        │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Recovery Value   │
              │ & Prioritization │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Policy &         │
              │ Guardrails       │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Recovery         │
              │ Orchestrator     │
              └────────┬─────────┘
                       │
                       ▼
              Razorpay Action API
                       │
                       ▼
              ┌──────────────────┐
              │ Outcome          │
              │ Verification     │
              └────────┬─────────┘
                       │
              ┌────────┴─────────┐
              ▼                  ▼
        Audit Ledger       Dashboard / API
```

The research similarly defines the integration as:

**Razorpay Webhook Stream → Ingestion → Revenue State → Root Cause → ERV Prioritization → Execution → Verification.** 

---

# 4. Implementation Scope

The first implementation shall focus on three capabilities:

1. Failed-payment recovery
2. Payment degradation detection
3. Revenue recovery prioritization

Checkout abandonment and subscription recovery should be represented in the architecture, but they should not block the first end-to-end implementation unless the validated Razorpay APIs provide a sufficiently reliable test flow.

The first fully demonstrated workflow should be:

```text
Payment fails
    ↓
RRE receives payment.failed
    ↓
Revenue opportunity created
    ↓
Failure diagnosed
    ↓
Recoverability estimated
    ↓
Expected recovery calculated
    ↓
Opportunity prioritized
    ↓
Policy evaluated
    ↓
Recovery action selected
    ↓
Razorpay action executed
    ↓
Payment state changes
    ↓
RRE receives verification event
    ↓
Recovered revenue recorded
    ↓
Dashboard updates
```

---

# 5. Technology Strategy

The implementation should remain deliberately simple. The complete application shall be reproducible from a clean machine using Docker Compose. A judge shall be able to clone the repository, configure the required environment variables, and start the complete application without installing Node.js, PostgreSQL, or other application dependencies on the host.

A suitable initial structure is:

```text
Backend
  TypeScript
  NestJS (with rawBody: true for webhook raw request buffer preservation)
  BullMQ (@nestjs/bullmq for durable background job execution)

Database & Storage
  PostgreSQL (Authoritative application, event, and business state store)
  Redis 7 (redis:7-alpine, backing store for BullMQ job queues)

Frontend
  React
  Vite

Razorpay
  REST APIs
  Webhooks

AI
  LLM-assisted diagnosis/reasoning where useful
  Deterministic financial calculations
  Deterministic policy engine

Observability
  Structured application logs
  Metrics
  Optional Grafana integration

Deployment
  Docker Compose (Single environment running NestJS, PostgreSQL, and Redis)
```

The HTTP framework layer MUST preserve the unparsed binary request body Buffer (`req.rawBody`) for all webhook endpoints prior to JSON parsing, enabling cryptographic HMAC SHA-256 signature verification against the original byte stream.

PostgreSQL serves as the authoritative, durable source of truth for all application data, `WebhookEvent` history, and `RecoveryOpportunity` state. Redis 7 and BullMQ provide durable, asynchronous background job execution.

The AI layer should not be responsible for basic arithmetic, state transitions, policy enforcement, or financial verification.

Those should remain deterministic.

---

# 6. Backend Module Architecture

The backend should be divided by business responsibility rather than by individual API endpoints.

```text
src/
├── auth/
├── merchant/
├── razorpay/
│   ├── client/
│   ├── webhooks/
│   ├── payments/
│   ├── orders/
│   ├── payment-links/
│   └── subscriptions/
│
├── events/
│   ├── store/
│   ├── queues/
│   └── processors/
│
├── revenue/
│   ├── state/
│   ├── detection/
│   ├── diagnosis/
│   └── valuation/
│
├── recovery/
│   ├── prioritization/
│   ├── policy/
│   ├── orchestration/
│   ├── actions/
│   └── verification/
│
├── audit/
├── analytics/
└── dashboard/
```

The exact framework structure may differ, but these responsibilities should remain separated.

---

# 7. Razorpay Integration Layer

The Razorpay integration must be isolated behind an internal adapter.

Conceptually:

```text
RRE Business Logic
        │
        ▼
RazorpayIntegration
        │
        ├── Payments
        ├── Orders
        ├── Payment Links
        ├── Invoices
        ├── Subscriptions
        └── Webhooks
```

Business logic should not directly construct raw Razorpay HTTP requests.

For example, recovery logic should express:

```text
createRecoveryPaymentLink(...)
```

rather than:

```text
POST /v1/payment_links
```

This makes the recovery system independent of low-level API details.

---

# 8. Webhook Ingestion

Webhook ingestion is the primary event entry point for all incoming Razorpay payment and recovery telemetry.

The exact ingestion flow shall be:

```text
Razorpay Webhook HTTP Request
   ↓
Raw Body Preservation (req.rawBody Buffer)
   ↓
HMAC SHA-256 Signature Verification (X-Razorpay-Signature vs req.rawBody)
   ├── Signature Invalid / Missing ──► Log Security Alert ──► HTTP 400 Bad Request (Terminate)
   ↓
Payload Parsing & Identity Extraction (X-Razorpay-Event-Id / payload.event_id)
   ├── Malformed JSON / Invalid ────► Log Payload Error ───► HTTP 400 Bad Request (Terminate)
   ↓
Deduplication Check against Event Store (providerEventId)
   ├── Duplicate Detected ──────────► Log Notice ──────────► HTTP 200 OK (Acknowledge & Terminate)
   ↓
Persist WebhookEvent (status: PENDING)
   ├── DB Persistence Failure ──────► Log DB Error ────────► HTTP 500 Internal Server Error (Razorpay Retries)
   ↓
Acknowledge Razorpay (HTTP 200 OK)
   ↓
Asynchronous Processing Pipeline
```

### 8.1 Raw Body Preservation & HMAC Signature Verification

1. **Raw Body Preservation**:
   * The NestJS HTTP application layer MUST be initialized with `rawBody: true` (`NestFactory.create(AppModule, { rawBody: true })`), attaching the unparsed binary Buffer (`req.rawBody`) to the incoming request object before JSON body-parsing middleware executes.
   * HMAC SHA-256 signature verification MUST be calculated directly against the exact, unparsed binary bytes contained in `req.rawBody`.
   * **STRICT PROHIBITION**: Re-serializing a parsed JavaScript object (e.g. `JSON.stringify(req.body)`) is strictly prohibited. Property re-ordering, spacing differences, or key escaping during JSON re-stringification mutates the payload byte stream, resulting in signature verification failure.

2. **HMAC SHA-256 Signature Verification Procedure**:
   * **Header Extraction**: Retrieve `X-Razorpay-Signature` from HTTP request headers.
   * **Secret Retrieval**: Retrieve the merchant's configured `webhook_secret` from secure backend configuration.
   * **Signature Computation**: Compute expected digest via `crypto.createHmac('sha256', webhook_secret).update(req.rawBody).digest('hex')`.
   * **Constant-Time Comparison**: Compare incoming signature with computed signature using constant-time equality check (`crypto.timingSafeEqual`).
   * **Signature Failure Handling**: If `X-Razorpay-Signature` is missing, malformed, or fails comparison:
     - Log a security audit warning (`WEBHOOK_SIGNATURE_FAILED`).
     - Return `HTTP 400 Bad Request` (or `401 Unauthorized`) immediately.
     - Do NOT persist the event to the database.
     - Do NOT trigger downstream processing.

3. **Payload Parsing & Identity Extraction**:
   * Once signature verification succeeds, parse `req.rawBody` into a JSON payload object.
   * Extract the unique provider event identifier `providerEventId` from header `X-Razorpay-Event-Id` (or payload root `event_id`) and the event type string from `payload.event` (e.g., `payment.failed`, `payment_link.paid`).
   * **Malformed Payload Handling**: If JSON parsing fails or mandatory event envelope headers are missing:
     - Log a payload validation error.
     - Return `HTTP 400 Bad Request` immediately without persisting.

4. **Deduplication Check**:
   * Query the `WebhookEvent` table for an existing record matching `providerEventId`.
   * **Duplicate Event Handling**: If a record with `providerEventId` already exists:
     - Log an informational notice (`WEBHOOK_DUPLICATE_RECEIVED`).
     - Return `HTTP 200 OK` immediately to acknowledge receipt to Razorpay (preventing further Razorpay webhook retry attempts).
     - Do NOT re-persist or trigger duplicate downstream processing.

5. **Durable Event Persistence**:
   * Create and save a new `WebhookEvent` record with `processingStatus: 'PENDING'`, storing `providerEventId`, `eventType`, `payload` (parsed JSON), and `receivedAt` timestamp.
   * **Persistence Failure Handling**: If database persistence fails (e.g. database connection timeout):
     - Log a database error.
     - Return `HTTP 500 Internal Server Error`. This signals HTTP failure to Razorpay, triggering Razorpay's standard backoff retry schedule for webhook delivery.

6. **HTTP Acknowledgement & Enqueue Boundary**:
   * Upon successful persistence of the `WebhookEvent` (`processingStatus: 'PENDING'`) in PostgreSQL, the HTTP handler enqueues a background job into BullMQ (`webhookQueue.add('process-event', { eventId: webhookEvent.id })`).
   * The HTTP handler returns `HTTP 200 OK` to Razorpay immediately.
   * **STRICT PROHIBITION**: The webhook HTTP handler MUST NOT execute AI diagnosis, ERV calculation, policy evaluation, Razorpay recovery actions, or other expensive downstream domain logic synchronously inside the HTTP request.

---

### 8.2 Asynchronous Queue & Worker Architecture (CRIT-03)

The downstream event processing pipeline is executed asynchronously by a NestJS queue processor (`@nestjs/bullmq`) running outside the HTTP request lifecycle.

```text
[Razorpay Webhook HTTP Request]
       │
       ▼
[Synchronous HTTP Controller]
  ├── 1. Validate HMAC signature (req.rawBody)
  ├── 2. Parse payload & check duplicate (providerEventId)
  ├── 3. Persist WebhookEvent in PostgreSQL (status: 'PENDING')
  ├── 4. Enqueue BullMQ job ({ eventId: webhookEvent.id })
  └── 5. Return HTTP 200 OK to Razorpay immediately
       │
       ▼ (Asynchronous Boundary)
[BullMQ Job Queue / Redis 7]
       │
       ▼
[NestJS Queue Processor / Worker]
  ├── 1. Load WebhookEvent from PostgreSQL by eventId
  ├── 2. Check processingStatus: if 'PROCESSED', skip (Worker Idempotency)
  ├── 3. Update processingStatus ──► 'PROCESSING'
  ├── 4. Execute Domain Processing Pipeline:
  │      ├── Failure Detection / Outcome Verification Engine
  │      ├── Cause Diagnosis & ERV Calculation
  │      ├── Policy Engine Evaluation
  │      └── Execute Razorpay Recovery Action (if policy approved)
  ├── 5. Persist resulting RecoveryOpportunity business state
  └── 6. Update WebhookEvent.processingStatus ──► 'PROCESSED'
```

1. **Worker Processing Flow & Idempotency**:
   * The BullMQ worker receives a job payload containing `{ eventId }`.
   * **Layer 2 Worker Idempotency**: The worker fetches the `WebhookEvent` record from PostgreSQL by `id`. If `processingStatus` is already `'PROCESSED'`, the worker logs an idempotency notice and terminates the job cleanly with success.
   * The worker updates `processingStatus` $\rightarrow$ `'PROCESSING'`.
   * The worker invokes the domain services (detection, root cause diagnosis, ERV calculation, policy validation, and Razorpay action execution).
   * Upon completing the domain logic, the worker updates the `RecoveryOpportunity` business state record and marks `WebhookEvent.processingStatus` $\rightarrow$ `'PROCESSED'` with `processedAt` timestamp.

2. **Configurable Worker Parameters**:
   The worker architecture is production-quality but MVP-appropriate, configured via environment variables with sensible defaults:
   * `WORKER_CONCURRENCY` (Default: `5`) — Number of concurrent job executions processed by the worker instance.
   * `JOB_MAX_RETRIES` (Default: `3`) — Maximum number of retry attempts for transient infrastructure failures.
   * `JOB_BACKOFF_INITIAL_DELAY_MS` (Default: `5000`) — Initial backoff delay in milliseconds for exponential retry backoff.

3. **Classification of Processing Outcomes**:
   * **Successful Processing with Business Outcome**:
     - The domain pipeline executes to completion.
     - Even if the business logic rejects an action (e.g. policy ceiling exceeded $\rightarrow$ `status: 'POLICY_BLOCKED'`), this represents a *successful business decision*, NOT a job error.
     - The business state (`RecoveryOpportunity.status`) is updated, and the infrastructure event (`WebhookEvent.processingStatus`) is marked `'PROCESSED'`.
   * **Transient Infrastructure / Service Failure**:
     - Occurs due to temporary network drops, Razorpay REST API 502/503 errors, or database lock contention.
     - The worker throws a retryable exception. BullMQ reschedules the job using exponential backoff up to `JOB_MAX_RETRIES`.
     - `WebhookEvent.processingStatus` remains `'PENDING'` or `'PROCESSING'`.
   * **Terminal Infrastructure Failure**:
     - Occurs if a job exhausts all `JOB_MAX_RETRIES` attempts due to a persistent downstream failure.
     - BullMQ marks `WebhookEvent.processingStatus` $\rightarrow$ `'FAILED'` and records `lastError`.
     - `RecoveryOpportunity` remains in a safe pending/retry state (`'PRIORITIZED'`) for merchant dashboard escalation.

4. **Separation of Infrastructure vs. Business State**:
   * **Infrastructure State** (`WebhookEvent.processingStatus`): Describes background job processing (`'PENDING'`, `'PROCESSING'`, `'PROCESSED'`, `'FAILED'`).
   * **Business State** (`RecoveryOpportunity.status`): Describes domain recovery lifecycle (`'OBSERVED'`, `'AT_RISK'`, `'DIAGNOSED'`, `'PRIORITIZED'`, `'ACTION_DISPATCHED'`, `'RECOVERED'`, etc.).

5. **MVP Architectural Boundaries & Deployment Simplicity**:
   * **Process Deployment**: The queue processor runs within the main NestJS application process during MVP; no separate deployable worker container is required.
   * **Infrastructure Simplicity**: The system uses PostgreSQL for application state, Redis 7 for BullMQ queue backing, and Docker Compose for local orchestration.
   * **Strict Prohibitions**: The architecture explicitly does NOT use Kafka, RabbitMQ, AWS SQS, two-phase commit, transactional outbox patterns, multi-region queues, or distributed locking frameworks. A small failure window between PostgreSQL persistence and Redis enqueue is acceptable for MVP.

---

# 9. Event Store

Every verified, authentic webhook event is persisted in the `WebhookEvent` table before returning `HTTP 200 OK` to Razorpay.

Conceptual Entity Schema:

```text
WebhookEvent
----------------
id                : UUID / ULID (Primary Key)
provider          : String (Default: 'razorpay')
providerEventId   : String (Derived from X-Razorpay-Event-Id / payload event_id)
eventType         : String (e.g., 'payment.failed', 'payment_link.paid')
payload           : JSONB / JSON Object (Parsed payload data)
receivedAt        : Timestamp (ISO-8601)
processedAt       : Nullable Timestamp (ISO-8601)
processingStatus  : Enum ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')
attemptCount      : Integer (Default: 0)
lastError         : Nullable Text
```

Application-level duplicate checks alone are insufficient due to potential race conditions during concurrent webhook deliveries from Razorpay. The PostgreSQL database table MUST define an explicit composite constraint `UNIQUE (provider, providerEventId)`. The database engine enforces this constraint atomically, providing the final concurrency-safe guarantee that prevents duplicate event persistence under high concurrency.

---

# 10. Revenue State Machine

The core of RRE is not the AI model.

It is the **revenue state machine**.

A payment opportunity moves through explicit, auditable states:

```text
OBSERVED
    ↓
AT_RISK
    ↓
DIAGNOSED
    ↓
VALUED
    ↓
PRIORITIZED
    ↓
ACTION_DISPATCHED
    ├── payment_link.partially_paid ──► PARTIALLY_RECOVERED
    │                                          │
    │                                          ├── payment_link.partially_paid ──► PARTIALLY_RECOVERED
    │                                          │
    │                                          ├── payment_link.paid ───────────► RECOVERED (Full)
    │                                          │
    │                                          └── payment_link.expired ────────► EXPIRED
    │
    ├── payment_link.paid ──────────────────────────────────────────────────────► RECOVERED (Full)
    │
    └── payment_link.expired / cancelled ───────────────────────────────────────► EXPIRED
```

Alternative terminal states:

```text
FAILED
EXPIRED
UNRECOVERABLE
POLICY_BLOCKED
```

### 10.1 Recovery State Transition Rules

1. **`ACTION_DISPATCHED` $\rightarrow$ `PARTIALLY_RECOVERED`**:
   Triggered by `payment_link.partially_paid` webhook when `remainingAmount > 0`. Cumulative `recoveredAmount` is updated with the captured payment amount.
2. **`PARTIALLY_RECOVERED` $\rightarrow$ `PARTIALLY_RECOVERED`**:
   Triggered by subsequent `payment_link.partially_paid` webhooks when `remainingAmount > 0`. Cumulative `recoveredAmount` is incremented.
3. **`PARTIALLY_RECOVERED` or `ACTION_DISPATCHED` $\rightarrow$ `RECOVERED`**:
   Triggered by `payment_link.paid` (or `payment_link.partially_paid`) when `remainingAmount == 0`. Opportunity is marked fully recovered and resolved.
4. **`ACTION_DISPATCHED` or `PARTIALLY_RECOVERED` $\rightarrow$ `EXPIRED`**:
   Triggered by `payment_link.expired` or `payment_link.cancelled` webhook. The link accepts no further payments. Any `recoveredAmount` collected prior to expiry remains counted as verified recovered revenue, while `remainingAmount` is written off as unrecovered.

Every transition MUST be recorded in the audit trail with the triggering event ID and timestamp.

---

# 11. Domain Data Models & Tenant Schema

A `RecoveryOpportunity` represents a detected revenue loss opportunity and maintains deterministic monetary ledger state.

All merchant-owned data tables MUST contain a `merchantId` column with foreign key constraints and `WHERE merchant_id = :merchantId` database query enforcement to ensure multi-tenant security isolation (NFR-SEC-005).

### 11.1 Merchant Authentication & Tenant Isolation Models (HIGH-05)

```text
Merchant
-------------------------
id                      : String / ULID (Primary Key, e.g., 'm_01H8X')
businessName            : String (Merchant account legal/trading name)
email                   : String (Unique primary merchant login email)
currency                : String (Default ISO currency, e.g., 'INR')
createdAt               : Timestamp (ISO-8601)
updatedAt               : Timestamp (ISO-8601)

MerchantCredential
-------------------------
id                      : UUID / ULID (Primary Key)
merchantId              : String (UNIQUE Foreign Key ──► Merchant.id)
keyId                   : String (Razorpay API Key ID, e.g., 'rzp_test_123')
encryptedKeySecret      : String (AES-256-GCM encrypted key secret string)
webhookSecret           : String (HMAC SHA-256 webhook verification secret)
updatedAt               : Timestamp (ISO-8601)

UserSession
-------------------------
id                      : UUID / ULID (Primary Key)
merchantId              : String (Foreign Key ──► Merchant.id)
userId                  : String (Internal user identifier)
tokenHash               : String (SHA-256 hash of JWT authorization token)
expiresAt               : Timestamp (ISO-8601)
createdAt               : Timestamp (ISO-8601)
```

`MerchantCredential` MUST store `keySecret` as an AES-256-GCM encrypted string. Plaintext API secrets MUST NEVER be stored in the database or returned in frontend API responses (NFR-SEC-001).

### 11.2 Core Revenue & Recovery Models

```text
RecoveryOpportunity
-------------------------
id                      : String / ULID (Primary Key, e.g., 'opp_01H8X')
merchantId              : String (Foreign Key ──► Merchant.id for tenant isolation)

sourceType              : Enum ('FAILED_PAYMENT', 'DEGRADATION', 'CHECKOUT_ABANDONED')
sourceId                : String (Provider source identifier)

originalTransactionId   : String (Original failed payment ID, e.g., 'pay_123')
originalOrderId         : String (Original merchant order ID, e.g., 'order_456')

lastReferenceId         : String (Unique per-attempt reference ID, max 40 chars, e.g., 'opp_01H8X_att_1')
lastPaymentLinkId       : Nullable String (Razorpay payment link ID, e.g., 'plink_789')
lastPaymentLinkUrl      : Nullable String (Short URL for checkout, e.g., 'https://rzp.io/i/xyz')

amount                  : Integer (Original gross revenue at risk in integer paise, e.g., 1000000 = ₹10,000.00)
recoveredAmount         : Integer (Cumulative verified revenue recovered so far in paise, default: 0)
remainingAmount         : Integer (Current active revenue at risk in paise: amount - recoveredAmount)
currency                : String (ISO currency code, e.g., 'INR')

cause                   : String (Normalized cause classification)
causeConfidence         : Float (0.0 to 1.0)

recoveryProbability     : Float (0.0 to 1.0)
interventionCost        : Integer (Minor units / paise)
expectedRecoveryValue   : Integer (Minor units / paise)
priorityScore           : Float (Derived priority score)

status                  : Enum ('OBSERVED', 'AT_RISK', 'DIAGNOSED', 'VALUED', 'PRIORITIZED', 'ACTION_DISPATCHED', 'PARTIALLY_RECOVERED', 'RECOVERED', 'FAILED', 'EXPIRED', 'POLICY_BLOCKED')

attemptCount            : Integer (Default: 0, incremented on each action attempt)
createdAt               : Timestamp (ISO-8601)
updatedAt               : Timestamp (ISO-8601)
resolvedAt              : Nullable Timestamp (ISO-8601)

RecoveryPayment
------------------
id                     : UUID / ULID (Primary Key)
merchantId             : String (Foreign Key ──► Merchant.id)
opportunityId          : String (Foreign Key ──► RecoveryOpportunity.id)
paymentLinkId          : String (Razorpay Payment Link ID, plink_...)
razorpayPaymentId      : String (UNIQUE Index — Razorpay payment ID, pay_...)
amount                 : Integer (Exact amount captured in this transaction, in paise)
status                 : String ('CAPTURED')
createdAt              : Timestamp (ISO-8601)
```

The `RecoveryPayment` table MUST define a `UNIQUE` index on `(merchantId, razorpayPaymentId)` to enforce payment-level financial idempotency.

### 11.3 Payment Degradation Telemetry Models (HIGH-02)

```text
PaymentTelemetry
------------------
id                     : UUID / ULID (Primary Key)
merchantId             : String (Foreign Key ──► Merchant.id)
paymentMethod          : String (e.g., 'card', 'upi', 'netbanking')
bank                   : String (e.g., 'HDFC', 'ICIC', 'UTIB', 'UNKNOWN')
status                 : String ('SUCCESS', 'FAILED')
failureReason          : Nullable String (e.g., 'gateway_error', 'invalid_otp')
amount                 : Integer (Transaction value in paise)
timestamp              : Timestamp (ISO-8601)

BankPerformanceBaseline
------------------------
id                     : UUID / ULID (Primary Key)
merchantId             : String (Foreign Key ──► Merchant.id)
paymentMethod          : String (e.g., 'card', 'upi', 'netbanking')
bank                   : String (e.g., 'HDFC', 'ICIC', 'UTIB')
baselineSuccessRate    : Float (Historical 7-day baseline percentage, 0.0 to 100.0)
currentSuccessRate     : Float (Rolling 1-hour window success percentage, 0.0 to 100.0)
sampleCount            : Integer (Total transactions evaluated in current window)
degradationFlagged     : Boolean (Default: false)
updatedAt              : Timestamp (ISO-8601)
```

The `BankPerformanceBaseline` table MUST define a `UNIQUE` index on `(merchantId, paymentMethod, bank)` for fast degradation anomaly scanning. 

---

# 12. Detection Layer

Detection converts raw Razorpay events into revenue opportunities.

For the MVP:

### Failed Payment

```text
payment.failed
      ↓
Eligibility checks
      ↓
RecoveryOpportunity
```

### Payment Degradation

### Payment Degradation Detection Specification (HIGH-02)

1. **Telemetry Ingestion**:
   * Every incoming payment event (success or failure) inserts a record into `PaymentTelemetry` (`merchantId`, `paymentMethod`, `bank`, `status`, `amount`, `timestamp`).
   * A retention policy prunes telemetry records older than 30 days.

2. **Rolling 1-Hour Aggregation Calculation**:
   * Periodically (e.g. every 5 minutes), RRE aggregates telemetry records over the trailing 1-hour window (`WHERE timestamp >= NOW() - INTERVAL '1 hour'`) grouped by `(merchantId, paymentMethod, bank)`.
   * Calculates:
     $$\text{currentSuccessRate} = \left(\frac{\text{Success Count}}{\text{Total Sample Count}}\right) \times 100$$
   * Updates `BankPerformanceBaseline` with the new `currentSuccessRate` and `sampleCount`.

3. **Degradation Anomaly Trigger**:
   * If `sampleCount >= MIN_DEGRADATION_SAMPLE_COUNT` (default: 10 transactions) AND:
     $$\text{currentSuccessRate} < (\text{baselineSuccessRate} - 20.0)$$
   * RRE flags `degradationFlagged = true` and creates a `RecoveryOpportunity` with `sourceType = 'DEGRADATION'`.

---

# 13. Root Cause Diagnosis

The diagnosis layer converts Razorpay payment failure information into a normalized internal classification.

Example:

```text
Razorpay error
      ↓
Source
Step
Reason
Metadata
      ↓
Normalized Cause
      ↓
Recoverability Class
```

Possible classes:

```text
TEMPORARY
CUSTOMER_ACTION_REQUIRED
PAYMENT_INSTRUMENT_INVALID
BANK/GATEWAY_FAILURE
NETWORK_FAILURE
MERCHANT_CONFIGURATION
UNKNOWN
```

The research identifies Razorpay's structured error taxonomy as useful for this classification. 

The system should not hard-code every error into an AI prompt.

Prefer:

```text
Razorpay error taxonomy
        ↓
Deterministic classification
        ↓
AI interpretation where ambiguity exists
```

---

# 14. AI Responsibility & Fallback Architecture (HIGH-03)

The architecture enforces a strict separation between **deterministic business systems** and **advisory AI reasoning services**.

### 14.1 System Responsibilities & Boundaries

1. **Deterministic System Primacy**:
   Deterministic functions 100% own and execute:
   * Financial calculations and minor-unit monetary ledgers.
   * Root-cause classification derived from Razorpay error taxonomy (`source`, `step`, `reason`).
   * Expected Recoverable Value (ERV) formula calculations ($ERV = P_{\text{success}} \times \text{Amount}$).
   * Recovery policy engine validation and retry limit enforcement.
   * Recovery action authorization and payment verification.
   * Opportunity state machine transitions and audit logging.

2. **Advisory AI Role**:
   The LLM/AI layer acts strictly in an advisory and asynchronous capacity to generate:
   * Human-readable narrative root-cause explanations (FR-010, FR-029).
   * Merchant-facing opportunity summaries (FR-030).
   * Contextual recovery recommendations for dashboard UI displays.

### 14.2 AI Fault Tolerance & Deterministic Fallbacks

AI service failures (LLM API timeout, rate limiting, network unavailability, malformed JSON response, or low confidence scores) **MUST NOT** block, delay, or crash core financial processing or recovery state transitions (NFR-FH-005).

1. **Timeout & Error Handling**:
   * LLM API requests are subject to a strict 3000ms timeout budget.
   * If the LLM request times out, throws a 4xx/5xx HTTP error, or returns unparseable JSON, RRE catches the exception cleanly and invokes the **Deterministic Fallback Generator**.

2. **Deterministic Explanation Fallback Template**:
   When AI is unavailable or produces low-confidence output (`causeConfidence < 0.60`), RRE generates a standardized narrative template:
   $$\text{"Payment failure classified as } \langle\text{cause}\rangle \text{ based on Razorpay error taxonomy (source: } \langle\text{source}\rangle \text{, reason: } \langle\text{reason}\rangle \text{). Action authorized per merchant policy rules."}$$

3. **Core Pipeline Continuity**:
   The `RecoveryOpportunity` is created, diagnosed, valued, prioritized, and dispatched normally regardless of whether the narrative explanation was generated by AI or by the deterministic fallback generator.

The core principle remains:

> **AI proposes and explains; deterministic systems authorize, execute, and verify.**

---

# 15. Expected Recoverable Value

The primary prioritization mechanism is Expected Recoverable Value.

The research defines:

```text
ERV =
P(success | cause, timing, rail)
× transaction value
− intervention cost
```



For the MVP, this should not immediately become a sophisticated ML model.

Start with a calibrated recovery-probability model.

For example:

```text
Recovery Probability =
  base probability
  × cause factor
  × payment-method factor
  × customer-history factor
  × retry-history factor
```

The implementation should make these factors explicit and inspectable.

Once sufficient test data exists, the probability model can be replaced or augmented with a trained model.

---

# 16. Recovery Prioritization

Every active opportunity receives a priority score.

A simple first implementation:

```text
Priority =
Expected Recoverable Value
× urgency factor
× confidence factor
```

The system should rank opportunities by expected financial impact.

The dashboard should therefore not show:

> “327 failed payments.”

It should show:

> “₹2.4L potentially recoverable; these 14 opportunities account for ₹1.7L.”

---

# 17. Recovery Policy Engine

Before any action reaches Razorpay:

```text
AI Recommendation
       ↓
Policy Engine
       ↓
Allowed?
   /       \
 YES       NO
  ↓         ↓
Execute   Block
```

Policy examples:

```text
maxRetryCount
minimumRecoveryAmount
automaticExecution
allowedActions
maximumContactAttempts
recoveryWindow
```

The policy engine must be deterministic.

---

# 18. Recovery Action Layer

The action layer translates an approved recovery decision into a validated Razorpay operation.

The primary recovery vector for MVP is:

**Dynamic Payment Link Recovery (`POST /v1/payment_links`)**

### 18.1 Payment Link Creation & Correlation Specification

1. **Order Entity Disconnection**:
   * Razorpay's `POST /v1/payment_links` endpoint does NOT accept an `order_id` top-level parameter to associate an existing Razorpay Order.
   * Executing a Payment Link creation API call automatically instantiates a NEW internal Razorpay Order object (`order_new...`) within Razorpay. The original failed Razorpay Order ID (`originalOrderId`) MUST NOT be passed at top-level.

2. **Per-Attempt Reference ID Generation**:
   * Razorpay requires `reference_id` to be unique across the merchant account and capped at **maximum 40 characters**.
   * Re-using a static `opportunity_id` across retries causes Razorpay API to throw an HTTP 400 Bad Request error (`BAD_REQUEST_ERROR: reference_id must be unique`).
   * RRE MUST dynamically format `reference_id` per recovery attempt by appending an attempt counter suffix:
     $$\text{reference\_id} = \text{"opp\_"} + \text{shortOpportunityId} + \text{"\_att\_"} + \text{attemptCount}$$
     Example for Attempt 1: `opp_01H8X_att_1` (Total length: 15 chars $\le$ 40 chars).

3. **Structured Notes Metadata Payload**:
   * RRE MUST pass structured correlation metadata inside the `notes` object parameter of `POST /v1/payment_links`.
   * Required `notes` keys:
     ```json
     {
       "notes": {
         "opportunity_id": "opp_01H8X",
         "original_order_id": "order_DBJKIP31Y4jl8",
         "original_payment_id": "pay_EDNBKIP31Y4jl8",
         "merchant_id": "m_default"
       }
     }
     ```

4. **Exact API Request Payload Structure**:
   ```json
   {
     "amount": 10000,
     "currency": "INR",
     "accept_partial": false,
     "reference_id": "opp_01H8X_att_1",
     "description": "Recovery payment link for Order #order_DBJKIP31Y4jl8",
     "customer": {
       "name": "Customer Name",
       "email": "customer@example.com",
       "contact": "+919999999999"
     },
     "notify": {
       "sms": false,
       "email": true
     },
     "reminder_enable": true,
     "notes": {
       "opportunity_id": "opp_01H8X",
       "original_order_id": "order_DBJKIP31Y4jl8",
       "original_payment_id": "pay_EDNBKIP31Y4jl8"
     }
   }
   ```

5. **Entity Persistence on Action Dispatch**:
   Upon receiving successful HTTP 200/201 response from Razorpay, RRE MUST update the `RecoveryOpportunity` record:
   * Increment `attemptCount` by 1.
   * Store `lastReferenceId = response.reference_id` (e.g. `opp_01H8X_att_1`).
   * Store `lastPaymentLinkId = response.id` (e.g. `plink_Qge1CG0YA4ydIP`).
   * Store `lastPaymentLinkUrl = response.short_url` (e.g. `https://rzp.io/i/xyz`).
   * Transition `status` $\rightarrow$ `'ACTION_DISPATCHED'`.

6. **Test Mode Execution & UI Verification (HIGH-04)**:
   * In Razorpay Test Mode (`rzp_test_...`), real SMS and WhatsApp messages are suppressed and NOT delivered to customer mobile devices.
   * To enable real-time end-to-end demonstration and verification, RRE MUST persist `lastPaymentLinkUrl = response.short_url` in the database.
   * The RRE Control Tower UI MUST display a prominent **"Test Mode: Launch Payment Link"** button for all active recovery opportunities (`status == 'ACTION_DISPATCHED'` or `'PARTIALLY_RECOVERED'`), rendering `lastPaymentLinkUrl`.
   * Opening this URL launches the hosted Razorpay Test Checkout page, allowing the user to select test payment instruments, complete the test transaction, and trigger real `payment_link.partially_paid` or `payment_link.paid` webhooks back to RRE.

The system should avoid implementing multiple recovery actions simultaneously. Get one workflow completely correct first.

---

# 19. Recovery Verification

Verification is an independent subsystem.

It must not trust the recovery action creation response; financial recovery is recorded strictly upon authoritative Razorpay payment confirmation.

### 19.1 Partial Payment & Financial Ledger Verification Specification (CRIT-04)

```text
Razorpay Webhook: payment_link.partially_paid / payment_link.paid
       │
       ▼
Extract Tier 1 Opportunity Correlation (reference_id / notes.opportunity_id)
       │
       ▼
Begin PostgreSQL Transaction (SELECT ... FOR UPDATE on RecoveryOpportunity)
       │
       ├─► Check Payment Idempotency: SELECT 1 FROM RecoveryPayment WHERE razorpayPaymentId == payload.payment.entity.id
       │     │
       │     └── Exists? ──► Log Duplicate Notice ──► Terminate Transaction (No Double Counting)
       │
       ├─► Insert RecoveryPayment (razorpayPaymentId, amount = payload.payment.entity.amount, status = 'CAPTURED')
       │
       ├─► Calculate Ledger:
       │     recoveredAmount_new = recoveredAmount_old + payload.payment.entity.amount
       │     remainingAmount_new = max(0, amount - recoveredAmount_new)
       │
       ├─► Evaluate New Business State:
       │     ├── remainingAmount_new == 0 ──► status = 'RECOVERED', resolvedAt = now()
       │     └── remainingAmount_new > 0  ──► status = 'PARTIALLY_RECOVERED'
       │
       └── Commit Transaction & Record Audit Log
```

1. **Authoritative Webhook Event Triggers**:
   * **`payment_link.partially_paid`**: Emitted whenever a partial payment is captured and `amount_due > 0`.
   * **`payment_link.paid`**: Emitted when a payment completes the remaining balance (`amount_due == 0`).
   * **`payment_link.expired` / `payment_link.cancelled`**: Emitted when the link reaches its expiry time or is cancelled.

2. **Payment-Level Financial Idempotency (Layer 3)**:
   * To prevent duplicate webhook re-transmissions from double-counting recovered revenue:
   * The verification worker checks if a record with `razorpayPaymentId == payload.payment.entity.id` (`pay_...`) exists in the `RecoveryPayment` table.
   * **Duplicate Handling**: If the payment ID already exists in `RecoveryPayment`, the worker logs a duplicate payment notice, marks the `WebhookEvent.processingStatus = 'PROCESSED'`, and aborts the financial ledger update cleanly.

3. **Transactional Financial Ledger Update Execution**:
   The verification worker executes the following logic inside a single PostgreSQL database transaction with row-level locking (`SELECT ... FOR UPDATE` on `RecoveryOpportunity`):
   * **Payment Insertion**: Insert a new `RecoveryPayment` record storing `opportunityId`, `paymentLinkId`, `razorpayPaymentId`, and captured `amount` (in paise).
   * **Deterministic Ledger Recalculation**:
     $$\text{recoveredAmount}_{\text{new}} = \text{recoveredAmount}_{\text{old}} + \text{payload.payment.entity.amount}$$
     $$\text{remainingAmount}_{\text{new}} = \max(0, \text{amount} - \text{recoveredAmount}_{\text{new}})$$
   * **Business State Transition**:
     - If $\text{remainingAmount}_{\text{new}} == 0$: Set `status` $\rightarrow$ `'RECOVERED'`, `resolvedAt` = `now()`.
     - If $\text{remainingAmount}_{\text{new}} > 0$: Set `status` $\rightarrow$ `'PARTIALLY_RECOVERED'`.

4. **Link Expiration Handling**:
   * Upon receiving `payment_link.expired` or `payment_link.cancelled`:
     - RRE queries the `RecoveryOpportunity` record.
     - Sets `status` $\rightarrow$ `'EXPIRED'`, `resolvedAt` = `now()`.
     - **Financial Principle**: Any `recoveredAmount` collected prior to expiry remains permanently counted as verified recovered revenue. The outstanding `remainingAmount` is written off as unrecovered revenue loss.

---

# 20. Opportunity-to-Payment Correlation

Every recovery-generated Razorpay object MUST carry structured correlation identifiers.

### 20.1 Correlation Architecture & Order Disconnection Rules

1. **Razorpay Internal Order Creation**:
   * Standard Razorpay Payment Links instantiate their own internal Razorpay Order (`order_new...`) within Razorpay and do NOT reuse or accept the merchant's `original_order_id`.
   * Therefore, RRE MUST NOT rely on top-level `order_id` in webhook payloads to match payment link recoveries back to original merchant orders.

2. **Two-Tier Correlation Strategy**:
   When a `payment_link.paid` webhook is received:

   ```text
   Razorpay Webhook: payment_link.paid
           │
           ├─► Extract reference_id / notes.opportunity_id
           │         │
           │         ▼ (Tier 1: Opportunity Match)
           │   RecoveryOpportunity Record (opp_01H8X)
           │
           └─► Extract notes.original_order_id
                     │
                     ▼ (Tier 2: Merchant Order Match)
               Original Merchant Order History (order_DBJK...)
   ```

   * **Tier 1 (Primary Opportunity Correlation)**:
     - RRE extracts `payload.payment_link.entity.reference_id` (or `payload.payment_link.entity.notes.opportunity_id`).
     - RRE queries `RecoveryOpportunity` where `id == notes.opportunity_id` or `lastReferenceId == payload.payment_link.entity.reference_id`.
     - Matching this identifier binds the financial outcome directly to the internal RRE recovery workflow.

   * **Tier 2 (Secondary Merchant Order Correlation)**:
     - RRE extracts `payload.payment_link.entity.notes.original_order_id`.
     - RRE logs the recovered revenue event against the merchant's original order context in the audit ledger.

3. **Strict Matching Policy**:
   * The system MUST NEVER rely on fuzzy matching such as:
     ```text
     amount == amount
     ```
     or customer email matching as the sole correlation mechanism. Correlation MUST rely on exact string equality against `reference_id` or `notes.opportunity_id`.

---

# 21. Audit Architecture

Audit logging should be implemented as a first-class subsystem.

Every major operation creates an audit event:

```text
EVENT_RECEIVED
OPPORTUNITY_CREATED
DIAGNOSIS_COMPLETED
VALUATION_COMPLETED
PRIORITY_ASSIGNED
POLICY_CHECKED
ACTION_APPROVED
ACTION_EXECUTED
ACTION_FAILED
VERIFICATION_STARTED
RECOVERY_VERIFIED
OPPORTUNITY_CLOSED
```

Conceptually:

```text
AuditEvent
----------------
id               : UUID / ULID (Primary Key)
merchantId       : String (Foreign Key ──► Merchant.id for tenant isolation)
opportunityId    : String (Foreign Key ──► RecoveryOpportunity.id)
eventType        : String (e.g., 'DIAGNOSIS_COMPLETED', 'ACTION_DISPATCHED')
actor            : String (e.g., 'SYSTEM_DETERMINISTIC', 'AI_ADVISORY', 'MERCHANT_USER')
userExplanation  : String (Sanitized, human-readable narrative explanation exposed to Control Tower UI)
technicalSnapshot: JSONB / JSON Object (Structured internal diagnostic metadata, inputs, and outputs)
timestamp        : Timestamp (ISO-8601)
```

### 21.1 Audit Field Separation & Security Policy (MED-03)

1. **`userExplanation`**:
   Contains clean, sanitized, merchant-facing narrative explanations (generated by AI or deterministic fallback templates). Exposed directly via the Control Tower UI.
2. **`technicalSnapshot`**:
   Contains structured JSON metadata (e.g., Razorpay `source`, `step`, `reason`, `attemptCount`, calculation variables) reserved for internal diagnostics and compliance audits.
3. **Strict Credential & Prompt Hygiene**:
   Raw LLM prompt dumps, API key secrets, authorization tokens, or sensitive merchant credentials MUST NEVER be written into `userExplanation` or `technicalSnapshot` fields or returned over public dashboard APIs.

---

# 22. Dashboard Architecture

The dashboard should be driven from persisted RRE state.

Primary views:

### Executive Summary

```text
Revenue at Risk
₹X (SUM of remainingAmount for active/partially recovered opportunities)

Expected Recoverable
₹Y (SUM of expectedRecoveryValue for active opportunities)

Verified Recovered
₹Z (SUM of recoveredAmount across all opportunities / SUM of RecoveryPayment.amount)

Active Opportunities
N (Count of opportunities in active/partially recovered status)

Recovery Rate
R% (Verified Recovered / (Verified Recovered + Active Revenue at Risk) * 100)
```

### Opportunity Queue

```text
Priority | Amount | Expected Recovery | Cause | Action | Status
```

### Opportunity Detail

```text
Payment
   ↓
Failure
   ↓
Diagnosis
   ↓
Recovery estimate
   ↓
Policy
   ↓
Action
   ↓
Razorpay result
   ↓
Verified recovery
```

### Audit Timeline

A chronological view of every decision and action.

---

# 23. Real-Time Dashboard Updates

The dashboard should reflect state changes without requiring the user to manually reconstruct what happened.

A practical implementation is:

```text
Razorpay webhook
      ↓
Backend state update
      ↓
Frontend event/update
      ↓
Dashboard refresh
```

WebSocket or Server-Sent Events can be introduced if required.

Polling is acceptable for the initial implementation if it provides a sufficiently responsive demonstration.

Do not introduce real-time infrastructure merely for architectural appearance.

---

# 24. Database Strategy

PostgreSQL should be the primary persistent store.

Core tables:

```text
merchants
merchant_policies

razorpay_events

payments
orders

recovery_opportunities
recovery_actions
recovery_verifications

recovery_predictions
recovery_decisions

audit_events

revenue_metrics
```

Important relationships:

```text
Merchant
   │
   ├── Payments
   │
   ├── Opportunities
   │       │
   │       ├── Decisions
   │       ├── Actions
   │       ├── Verifications
   │       └── Audit Events
   │
   └── Policy
```

---

# 25. Idempotency Strategy

Idempotency must exist at multiple levels.

### Webhook level

Unique Razorpay event identifier.

### Opportunity level

Unique business opportunity for a payment/failure condition.

### Action level

Unique recovery-action identifier.

### Verification level

Unique payment/outcome correlation.

The system must prevent:

```text
1 webhook
→ 2 opportunities
→ 2 payment links
```

or:

```text
1 successful payment
→ 2 recovered-revenue records
```

---

# 26. API Strategy

The backend API should expose business-oriented endpoints.

Example:

```text
GET    /api/dashboard/summary

GET    /api/opportunities
GET    /api/opportunities/:id

GET    /api/opportunities/:id/audit

POST   /api/opportunities/:id/approve
POST   /api/opportunities/:id/recover

GET    /api/recovery/metrics

GET    /api/merchant/policy
PATCH  /api/merchant/policy

POST   /api/razorpay/webhooks
```

Razorpay-specific APIs remain internal to the integration module wherever possible.

---

# 27. Testing Strategy

Testing should be organized around the complete financial lifecycle rather than individual functions.

## Level 1 — Unit Tests

Test:

* ERV calculation
* Priority calculation
* Policy evaluation
* Error classification
* State transitions
* Retry rules
* Monetary calculations

## Level 2 — Integration Tests

Test:

* Razorpay API client
* Webhook validation
* Database persistence
* Opportunity creation
* Recovery action execution
* Outcome verification

## Level 3 — End-to-End Test

Run:

```text
Razorpay test transaction
        ↓
payment.failed
        ↓
RRE opportunity
        ↓
diagnosis
        ↓
recovery decision
        ↓
payment link
        ↓
test payment
        ↓
payment_link.paid
        ↓
verified recovery
        ↓
dashboard
```

This is the most important test.

---

# 28. Failure Scenarios

At minimum, implement and test:

### Duplicate webhook

Expected:

```text
One opportunity
One action
One outcome
```

### Invalid webhook signature

Expected:

```text
Rejected
No state change
Security event recorded
```

### Razorpay API failure

Expected:

```text
Action = FAILED/PENDING
Recovery = 0
Audit = recorded
```

### Payment never completed

Expected:

```text
Opportunity remains unresolved
Recovered revenue = ₹0
```

### Successful recovery

Expected:

```text
Payment verified
Opportunity = RECOVERED
Actual recovery updated
Dashboard updated
```

---

# 29. Evaluation Strategy

The system should be evaluated using a controlled batch of test-mode/synthetic scenarios.

Each scenario should have a known expected outcome.

Example:

```text
Scenario       Amount    Failure             Expected Action
------------------------------------------------------------
A              ₹5,000    Temporary failure   Retry
B              ₹25,000   Recoverable         Payment Link
C              ₹800      Low value            Ignore
D              ₹50,000   High value          Approval
E              ₹10,000   Permanent failure   Stop
```

The evaluation should measure:

```text
Detection accuracy
Diagnosis accuracy
Recovery-action appropriateness
Policy violations
Successful recoveries
False recoveries
Actual recovered amount
```

The objective is not maximum automation.

The objective is **maximum correctly recovered revenue under the defined constraints**.

---

# 30. Development Phases

## Phase 0 — Razorpay Capability Lock

Before implementation begins:

* Freeze the validated API/event surface.
* Record exact API operations confirmed through the test account.
* Record unsupported operations.
* Record test scenarios that can reproduce each relevant state.

Deliverable:

```text
RAZORPAY_CAPABILITY_MATRIX.md
```

This prevents implementation from depending on assumptions from the research.

---

## Phase 1 — Integration Foundation

Implement:

* Razorpay credentials
* API client
* Webhook endpoint
* Signature validation
* Event persistence
* Event deduplication
* Basic synchronization

Success criterion:

> A real Razorpay test event appears in RRE.

---

## Phase 2 — Revenue State

Implement:

* Payment/order representation
* Revenue opportunity
* State machine
* Failure classification
* Opportunity creation
* Audit events

Success criterion:

> A failed Razorpay test payment automatically becomes an RRE revenue opportunity.

---

## Phase 3 — Intelligence

Implement:

* Root-cause diagnosis
* Recovery probability
* Expected Recoverable Value
* Priority calculation
* Explainable decision record

Success criterion:

> RRE can explain why one opportunity should be recovered before another.

---

## Phase 4 — Policy & Recovery

Implement:

* Merchant policy
* Recovery limits
* Automatic/approval modes
* Recovery action adapter
* Idempotent action execution

Success criterion:

> RRE can safely execute one validated recovery action.

---

## Phase 5 — Verification

Implement:

* Recovery correlation
* Payment-state verification
* Recovery completion
* Failed recovery handling
* Reconciliation

Success criterion:

> A successful Razorpay test payment becomes verified recovered revenue.

---

## Phase 6 — Dashboard

Implement:

* Revenue summary
* Opportunity queue
* Opportunity details
* Decision explanation
* Audit timeline
* Recovery analytics

Success criterion:

> The dashboard tells the complete financial story of a real test transaction.

---

## Phase 7 — Batch Evaluation

Create a controlled batch containing:

* Recoverable failures
* Unrecoverable failures
* Different values
* Different causes
* Successful recovery
* Failed recovery
* Duplicate events
* Policy-blocked actions

Measure actual system performance.

---

## Phase 8 — Demo Hardening

The final system must support a clean demonstration:

```text
1. Open Razorpay test dashboard
2. Generate/execute test scenario
3. Show event entering RRE
4. Show opportunity created
5. Show AI diagnosis
6. Show expected recovery
7. Show policy decision
8. Execute recovery
9. Complete test payment
10. Show Razorpay payment result
11. Show RRE verification
12. Show recovered ₹
13. Open audit trail
```

This should be the final acceptance path.

---

# 31. What Should Not Be Built Initially

Do not start by implementing:

* Multiple AI agents
* Complex autonomous planning
* Reinforcement learning
* Sophisticated ML models
* Kafka
* Kubernetes
* Distributed microservices
* Complex bank-health prediction
* Multiple communication channels
* Advanced customer segmentation
* Dynamic discount optimization

None of these are necessary to prove the central thesis.

The first objective is:

> **Can RRE correctly identify a revenue opportunity and recover real test-mode money through a bounded, explainable workflow?**

Once that works, intelligence can be expanded.

---

# 32. Final Architecture

The resulting implementation should converge toward:

```text
                         RAZORPAY
                    Test APIs / Webhooks
                           │
                           ▼
                 ┌───────────────────┐
                 │ Integration Layer │
                 │ API + Webhook     │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Event Store       │
                 │ Idempotency       │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Revenue State     │
                 │ Machine           │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Detection         │
                 │ + Diagnosis       │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ ERV +             │
                 │ Prioritization    │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Policy /          │
                 │ Guardrails        │
                 └─────────┬─────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
               AUTOMATIC       HUMAN
                ACTION         APPROVAL
                    │             │
                    └──────┬──────┘
                           ▼
                 ┌───────────────────┐
                 │ Recovery          │
                 │ Orchestrator      │
                 └─────────┬─────────┘
                           │
                           ▼
                    RAZORPAY API
                           │
                           ▼
                 ┌───────────────────┐
                 │ Verification      │
                 │ + Reconciliation  │
                 └─────────┬─────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
          Audit Ledger          Revenue Metrics
                                      │
                                      ▼
                              Interactive Dashboard
```

This architecture preserves the key positioning established by the research: **Razorpay owns payment execution; RRE owns cross-workflow revenue intelligence, prioritization, policy-aware orchestration, and measurement.** 

The critical implementation milestone is not “AI agent completed.” It is the following end-to-end proof:

**Razorpay test transaction → real webhook → RRE opportunity → explainable decision → bounded Razorpay action → real payment state → verified recovered revenue → dashboard + audit trail.**

That should be treated as the project's primary vertical slice.
