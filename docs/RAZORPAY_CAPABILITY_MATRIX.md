# RAZORPAY_CAPABILITY_MATRIX.md

## 1. Purpose & Scope

This document establishes the official capability boundary between the **Revenue Recovery Engine (RRE)** and the **Razorpay Payment Infrastructure**. 

RRE operates as an **intelligence, prioritization, and orchestration layer** around Razorpay. To ensure financial correctness and system integrity, RRE must build exclusively against verified or officially documented Razorpay API behaviors and webhook contracts.

This matrix extracts and evaluates all Razorpay APIs, resources, webhook events, authentication mechanisms, payment/recovery flows, and correlation metadata relevant to RRE requirements (`FUNCTIONAL_REQUIREMENTS.md`, `NON_FUNCTIONAL_REQUIREMENTS.md`) and implementation strategy (`IMPLEMENTATION_STRATEGY.md`).

---

## 2. Classification Criteria

Every capability is assigned one of the following statuses:

* **`VALIDATED`** — Experimentally verified against the active Razorpay test environment, backed by empirical test logs or recorded execution outputs within the project workspace. *(Note: Per strict governance rules, no capability is marked VALIDATED unless empirical test execution logs exist in the repository).*
* **`DOCUMENTED`** — Fully supported and specified in official Razorpay developer documentation (`razorpay.com/docs`), but pending live end-to-end integration testing in this specific project workspace.
* **`REQUIRED-UNVALIDATED`** — Explicitly required for RRE MVP implementation (e.g. primary vertical slice), documented by Razorpay, but awaiting empirical verification in the project test environment.
* **`DEFERRED`** — Documented Razorpay capability that is intentionally scoped out of the initial MVP to preserve implementation focus.
* **`UNAVAILABLE` / `BLOCKED`** — Internal Razorpay capability, private/undocumented behavior, or feature that cannot be relied upon in Test Mode or production API integrations.

---

## 3. Concise Capability Matrix

| Capability ID | Razorpay Resource / API / Event | Category | Requirement / Phase Mapping | Status | MVP Critical? | Correlation / Key Identifier |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAP-AUTH-01** | Basic Auth (`Key ID` / `Key Secret`) | Security / Auth | FR-001, NFR-SEC-001 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `rzp_test_...` credentials |
| **CAP-AUTH-02** | Webhook HMAC SHA-256 (`X-Razorpay-Signature`) | Security / Auth | NFR-REL-002, NFR-SEC-003 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `X-Razorpay-Signature` header |
| **CAP-ORD-01** | Orders API (`POST /v1/orders`) | Ingestion / Intent | FR-003, FR-007 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `order_id` (`order_...`) |
| **CAP-ORD-02** | Fetch Order API (`GET /v1/orders/{id}`) | Ingestion / Abandonment | FR-007 / Phase 1 | `DOCUMENTED` | NO (Secondary) | `order_id` (`order_...`) |
| **CAP-EVT-01** | Webhook Event: `payment.failed` | Detection / Event | FR-003, FR-005 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `payment_id`, `order_id`, `X-Razorpay-Event-Id` |
| **CAP-EVT-02** | Webhook Event: `payment.authorized` | Ingestion / Capture | FR-003 / Phase 1 | `DOCUMENTED` | NO | `payment_id`, `order_id` |
| **CAP-EVT-03** | Webhook Event: `payment.captured` | Verification / Ledger | FR-003, FR-021, NFR-FC-001 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `payment_id`, `order_id` |
| **CAP-EVT-04** | Webhook Event: `payment_link.paid` | Verification / Ledger | FR-021, NFR-FC-001 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `payment_link_id`, `reference_id`, `notes` |
| **CAP-EVT-05** | Webhook Event: `payment_link.cancelled` / `.expired` | Verification / Termination | FR-020, NFR-BA-005 / Phase 1 | `DOCUMENTED` | NO | `payment_link_id`, `reference_id` |
| **CAP-ERR-01** | Error Taxonomy (`source`, `step`, `reason`, `code`) | Diagnosis | FR-010, FR-011 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `payload.payment.entity.error` |
| **CAP-ACT-01** | Payment Links API (`POST /v1/payment_links`) | Recovery Action | FR-015, FR-018, NFR-ID-001 / Phase 1 | `REQUIRED-UNVALIDATED` | **YES** | `reference_id` (Max 40 chars), `notes` |
| **CAP-ACT-02** | Payment Capture API (`POST /v1/payments/{id}/capture`) | Recovery Action | FR-015 / Phase 1 | `DOCUMENTED` | NO | `payment_id` |
| **CAP-SUB-01** | Subscriptions Engine (`subscription.pending` / `.halted`) | Subscription Failure | FR-008 / Phase 3 | `DEFERRED` | NO | `subscription_id` |
| **CAP-SUB-02** | Invoice Retry API (`POST /v1/invoices/{id}/retry`) | Subscription Action | FR-015 / Phase 3 | `DEFERRED` | NO | `invoice_id` |
| **CAP-INT-01** | Internal Gateway Routing & Failover Trees | Private Routing | Research Section 7 | `UNAVAILABLE` | NO | None (Private Razorpay System) |
| **CAP-INT-02** | Issuer Queue Depth & Real-time Bank Health API | Telemetry | Research Section 7 | `UNAVAILABLE` | NO | None (Private Razorpay System) |
| **CAP-INT-03** | Direct 3DS Authentication Override | Auth Override | Safety Policy | `BLOCKED` | NO | None (Violates PCI-DSS / Issuer Rules) |

---

## 4. Evidence and Status Details by Capability

### 4.1 Security & Authentication Capabilities

#### CAP-AUTH-01: Basic Authentication API Access
* **Description**: HTTP Basic Authentication over HTTPS using `Key ID` as username and `Key Secret` as password (`Authorization: Basic base64(KeyID:KeySecret)`).
* **RRE Purpose**: Required for merchant onboarding validation (FR-001) and all server-side API requests to Razorpay (`/v1/orders`, `/v1/payment_links`).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in official Razorpay API specifications (`https://razorpay.com/docs/api/#authentication`). Pending live test execution confirmation in this project workspace.
* **Limitations**: Credentials must start with `rzp_test_` in test mode. Secrets must never be exposed to frontend clients (NFR-SEC-001).
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 1 (Foundation & Integration Layer)

#### CAP-AUTH-02: Webhook HMAC SHA-256 Signature Verification
* **Description**: Every incoming webhook request contains an `X-Razorpay-Signature` header computed as `HMAC-SHA256(raw_request_body, webhook_secret)`.
* **RRE Purpose**: Ensures authenticity and integrity of incoming webhook events before processing state mutations (NFR-REL-002, NFR-SEC-003).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in official Razorpay Webhook guide (`https://razorpay.com/docs/webhooks/validate-test/`). Pending live signature verification test in project repo.
* **Limitations**: Must compute HMAC against the raw UTF-8 binary HTTP body before JSON parsing.
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 1 (Foundation & Integration Layer)

---

### 4.2 Order & Intent Capabilities

#### CAP-ORD-01: Orders API Creation (`POST /v1/orders`)
* **Description**: Creates a merchant payment intent with `amount` (in integer minor units / paise), `currency`, `receipt`, and `notes`. Returns `order_id` (`order_...`).
* **RRE Purpose**: Establishes initial payment intent context and correlation ID (`order_id`) prior to checkout initialization (FR-003, FR-007).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in Razorpay Orders API (`https://razorpay.com/docs/api/orders/`).
* **Limitations**: Amounts must be integer paise (`₹100.00` = `10000`).
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 1 (Foundation & Integration Layer)

#### CAP-ORD-02: Fetch Order Status (`GET /v1/orders/{id}`)
* **Description**: Retrieves current order state (`created`, `attempted`, `paid`) and total attempt count.
* **RRE Purpose**: Polling order status to identify abandoned checkouts where no payment attempt occurred after order creation (FR-007).
* **Status**: `DOCUMENTED`
* **Verified Evidence**: Documented in Razorpay Orders API.
* **Limitations**: Requires periodic polling or scheduled job background evaluation.
* **MVP Critical**: NO (Checkout abandonment is secondary scope)
* **Implementation Phase**: Phase 3 (Extended Detection Vectors)

---

### 4.3 Webhook Event Capabilities

#### CAP-EVT-01: `payment.failed` Webhook Event
* **Description**: Asynchronously emitted when a payment attempt fails. Payload includes `payment.entity` with `id`, `order_id`, `amount`, `method`, and structured `error` object (`code`, `description`, `source`, `step`, `reason`). Header includes `X-Razorpay-Event-Id`.
* **RRE Purpose**: Primary entry trigger for Revenue Opportunity detection and root cause diagnosis (FR-003, FR-005, FR-010).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in Razorpay Webhooks Reference (`https://razorpay.com/docs/webhooks/payloads/payments/`).
* **Limitations**: Can be re-delivered by Razorpay. RRE must handle deduplication via `X-Razorpay-Event-Id` (NFR-REL-003).
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 1 (Core Integration & State Engine)

#### CAP-EVT-03: `payment.captured` Webhook Event
* **Description**: Emitted when payment funds are successfully captured.
* **RRE Purpose**: Authoritative confirmation of payment completion for direct payments (FR-021, NFR-FC-001).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in Razorpay Payments Webhooks.
* **Limitations**: Must be reconciled against opportunity transaction ID.
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 1 (Outcome Verification)

#### CAP-EVT-04: `payment_link.paid` Webhook Event
* **Description**: Emitted when a customer successfully pays via a generated Payment Link. Payload contains `payment_link.entity` and nested `payment.entity`, including `reference_id` and custom `notes`.
* **RRE Purpose**: Primary verification event for Payment Link recovery workflows. Triggers transition to `RECOVERED` state and updates actual recovered revenue metrics (FR-021, FR-022, NFR-FC-001).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in Razorpay Payment Links Webhook API (`https://razorpay.com/docs/payments/payment-links/apis/#webhooks`).
* **Limitations**: Must verify that `amount_paid` matches expected recovery amount before marking financial recovery.
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 1 (Outcome Verification & Control Tower)

#### CAP-EVT-05: `payment_link.cancelled` / `payment_link.expired` Webhook Events
* **Description**: Emitted when a recovery payment link is manually cancelled or expires.
* **RRE Purpose**: Triggers workflow stopping rules and updates opportunity state to `EXPIRED` or `TERMINATED` (FR-020, NFR-BA-005).
* **Status**: `DOCUMENTED`
* **Verified Evidence**: Documented in Razorpay Payment Links API.
* **Limitations**: Requires link expiry configuration during creation.
* **MVP Critical**: NO (Secondary workflow cleanup)
* **Implementation Phase**: Phase 2 (Policy & Orchestration Engine)

---

### 4.4 Diagnostic & Error Taxonomy Capabilities

#### CAP-ERR-01: Razorpay Error Object Taxonomy
* **Description**: Detailed error breakdown provided in `payment.failed` payloads:
  * `source`: `customer` | `bank` | `gateway` | `network` | `internal`
  * `step`: `payment_initiation` | `payment_authentication` | `payment_authorization`
  * `reason`: `invalid_otp` | `insufficient_funds` | `payment_verification_declined` | `gateway_error` | `network_error`
  * `code`: `BAD_REQUEST_ERROR` | `GATEWAY_ERROR` | `SERVER_ERROR`
* **RRE Purpose**: Enables deterministic failure diagnosis (FR-010) and calculates recovery probability $P_{\text{success}}$ for ERV calculation (FR-013).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in official Razorpay Error Taxonomy (`https://razorpay.com/docs/payments/payment-gateway/error-codes/`).
* **Limitations**: Some legacy card declines return generic `payment_failed` reason; AI reasoning layer must handle unclassified fallback cases (FR-011).
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 2 (Detection & Diagnosis Engine)

---

### 4.5 Recovery Action Capabilities

#### CAP-ACT-01: Payment Links API Creation (`POST /v1/payment_links`)
* **Description**: Generates an asynchronous payment URL (`https://rzp.io/i/...`) delivered via SMS/Email or custom notification. 
  * Key inputs: `amount`, `currency`, `description`, `reference_id`, `customer` (`name`, `email`, `contact`), `notify` (`sms`, `email`), `notes`, `reminder_enable`.
* **RRE Purpose**: Primary non-destructive recovery vector for failed payments (FR-015, FR-018, IMPLEMENTATION_STRATEGY.md Section 18).
* **Status**: `REQUIRED-UNVALIDATED`
* **Verified Evidence**: Documented in official Razorpay Payment Links API (`https://razorpay.com/docs/api/payment-links/`).
* **Limitations**: 
  * `reference_id` must be unique per link and capped at 40 characters (e.g. `opp_01H...`). Re-using an existing `reference_id` returns HTTP 400.
  * In test mode, actual SMS/Email delivery is simulated or logged in the test dashboard.
* **MVP Critical**: **YES**
* **Implementation Phase**: Phase 2 (Action Execution Layer)

#### CAP-ACT-02: Payment Capture API (`POST /v1/payments/{id}/capture`)
* **Description**: Captures an authorized payment before the auth hold window expires (`status: authorized` $\rightarrow$ `captured`).
* **RRE Purpose**: Secondary recovery action to prevent revenue loss from expired authorization holds (FR-015).
* **Status**: `DOCUMENTED`
* **Verified Evidence**: Documented in Razorpay Payments API (`https://razorpay.com/docs/api/payments/#capture-a-payment`).
* **Limitations**: Applicable only to manual capture workflows (`authorized` payments).
* **MVP Critical**: NO
* **Implementation Phase**: Phase 3 (Extended Actions)

---

### 4.6 Deferred Capabilities (Post-MVP Scope)

#### CAP-SUB-01: Subscriptions Engine Events (`subscription.pending` / `.halted`)
* **Description**: Webhook events emitted when a recurring card/mandate charge fails or exhausts native retries.
* **RRE Purpose**: Intercept rigid T+1/T+2/T+3 retries to apply smart salary-cycle retry timing (FR-008).
* **Status**: `DEFERRED`
* **Reason for Deferral**: Requires subscription plan and mandate setup in test environment. Scoped to Phase 3 in `IMPLEMENTATION_STRATEGY.md`.

#### CAP-SUB-02: Invoice Retry API (`POST /v1/invoices/{id}/retry`)
* **Description**: Programmatically triggers a retry charge for an issued invoice.
* **RRE Purpose**: Recovery action for subscription and B2B invoice failures (FR-015).
* **Status**: `DEFERRED`
* **Reason for Deferral**: Secondary action vector; MVP focuses on primary dynamic Payment Link recovery.

---

### 4.7 Unavailable / Blocked Capabilities

#### CAP-INT-01: Internal Gateway Routing & Failover Controls
* **Description**: Modifying internal Razorpay smart-routing priority algorithms or acquiring bank routes per payment request.
* **Status**: `UNAVAILABLE`
* **Reason**: Private Razorpay internal infrastructure. Not exposed via merchant REST APIs. RRE must route recoveries via public channels (Payment Links / Rail shifts).

#### CAP-INT-02: Real-Time Issuer Queue Depth & Telemetry API
* **Description**: Querying live transaction queue depth or issuer node health directly from bank core systems.
* **Status**: `UNAVAILABLE`
* **Reason**: Not exposed by Razorpay. RRE must infer bank degradation probabilistically by aggregating incoming `payment.failed` webhook telemetry across rolling time windows (FR-006).

#### CAP-INT-03: Direct 3DS Authentication Bypass / Override
* **Description**: Programmatically bypassing OTP or 2FA authentication requirements.
* **Status**: `BLOCKED`
* **Reason**: Prohibited by Reserve Bank of India (RBI) regulations and PCI-DSS compliance requirements. 2FA must occur on Razorpay/Issuer hosted pages.

---

## 5. Primary Vertical Slice Assessment

The primary end-to-end vertical slice defined in `IMPLEMENTATION_STRATEGY.md` is:

```text
Razorpay test transaction 
  → payment.failed webhook 
  → RRE opportunity creation 
  → diagnosis & ERV calculation 
  → prioritization 
  → policy validation 
  → dynamic Payment Link creation (POST /v1/payment_links) 
  → test payment completion 
  → payment_link.paid webhook 
  → state verification 
  → verified recovered revenue
```

### Availability Assessment Matrix for Primary Vertical Slice

| Vertical Slice Step | Required Razorpay Dependency | Test Mode Availability | Operational Constraints / Test Behavior | Dependency Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Trigger Failure** | Checkout UI / Test Cards | **AVAILABLE** | Use Razorpay test card / UPI `failure@razorpay` to trigger `payment.failed`. | `REQUIRED-UNVALIDATED` |
| **2. Ingest Event** | `payment.failed` Webhook | **AVAILABLE** | Requires tunnel (e.g. ngrok/localtunnel) to local webhook endpoint. Signature validated via `X-Razorpay-Signature`. | `REQUIRED-UNVALIDATED` |
| **3. Execute Action** | `POST /v1/payment_links` API | **AVAILABLE** | Responds with HTTP 200/201 and valid `short_url` (`https://rzp.io/i/...`) in Test Mode. | `REQUIRED-UNVALIDATED` |
| **4. Pay Link** | Test Hosted Link UI | **AVAILABLE** | Opening `short_url` in Test Mode allows selecting "Success" test card to complete payment. | `REQUIRED-UNVALIDATED` |
| **5. Verify Revenue** | `payment_link.paid` Webhook | **AVAILABLE** | Razorpay dispatches `payment_link.paid` containing matching `reference_id` and `notes`. | `REQUIRED-UNVALIDATED` |

**Conclusion**: All required Razorpay capabilities for the primary vertical slice are officially supported and available in Razorpay Test Mode. None are blocked by missing APIs or third-party dependencies.

---

## 6. Proposed Payment Link Recovery Workflow Evaluation

The Payment Link recovery workflow is the core action mechanism for RRE MVP. The table below evaluates every technical requirement of this workflow:

| Workflow Requirement | Razorpay Mechanism | Verified API / Payload Structure | Correlation Strategy | Feasibility Status |
| :--- | :--- | :--- | :--- | :--- |
| **Link Generation** | `POST /v1/payment_links` | Takes `amount`, `currency`, `customer`, `reference_id`, `notes`. | `reference_id` = `RRE_OPP_<id>` (max 40 chars). | **FEASIBLE** |
| **Opportunity Mapping** | Metadata Embedding | `notes`: `{"opportunity_id": "opp_123", "merchant_id": "m_01"}` | Custom JSON object passed back in all link webhooks. | **FEASIBLE** |
| **Customer Delivery** | `notify: {"sms": false, "email": true}` | Email notification simulated or URL returned in response (`short_url`). | Merchant dashboard / RRE displays link for demo. | **FEASIBLE** |
| **Payment Completion** | Razorpay Test Link UI | Customer opens link and selects test payment method. | Native Razorpay test payment flow. | **FEASIBLE** |
| **Outcome Correlation** | `payment_link.paid` Webhook | Payload contains `payload.payment_link.entity.reference_id` & `payload.payment.entity.notes`. | Direct exact-match lookup on `reference_id` in database. | **FEASIBLE** |
| **Financial Verification** | Webhook Amount Check | Verify `payment.entity.amount` == `opportunity.amount`. | Prevents partial or incorrect financial counting (NFR-FC-001). | **FEASIBLE** |

> [!IMPORTANT]
> **Correlation Rule**: RRE must **NEVER** use fuzzy matching (e.g. matching solely on amount or customer email). Correlation **MUST** rely on strict exact-string equality using `reference_id` (capped at 40 characters) and `notes.opportunity_id`.

---

## 7. Webhook Payload Behavior & Identifier Mapping

To ensure reliable event processing and idempotency (NFR-REL-003, NFR-ID-001), RRE relies on specific JSON payload structures exposed by Razorpay webhooks:

### 7.1 Webhook Metadata & Header Identifiers
* **`X-Razorpay-Event-Id`**: Unique identifier for every webhook transmission. Stored by RRE event engine to drop duplicate transmissions.
* **`X-Razorpay-Signature`**: HMAC SHA-256 hash used to authenticate request sender.

### 7.2 Key Entity Field Extraction Table

| Event Type | Required Extract Field | JSON Path in Webhook Payload | System Function in RRE |
| :--- | :--- | :--- | :--- |
| `payment.failed` | Payment ID | `payload.payment.entity.id` | Source transaction identifier |
| `payment.failed` | Order ID | `payload.payment.entity.order_id` | Original merchant order correlation |
| `payment.failed` | Failure Amount | `payload.payment.entity.amount` | Gross Revenue at Risk calculation |
| `payment.failed` | Error Source | `payload.payment.entity.error.source` | Cause classification input (`customer`/`bank`/`gateway`) |
| `payment.failed` | Error Step | `payload.payment.entity.error.step` | Failure lifecycle stage identification |
| `payment.failed` | Error Reason | `payload.payment.entity.error.reason` | Specific diagnostic reason code |
| `payment_link.paid` | Link ID | `payload.payment_link.entity.id` | Action tracking ID |
| `payment_link.paid` | Reference ID | `payload.payment_link.entity.reference_id` | Exact internal Opportunity ID match |
| `payment_link.paid` | Notes Object | `payload.payment_link.entity.notes` | Secondary metadata correlation check |
| `payment_link.paid` | Captured Amount | `payload.payment.entity.amount` | Verified Recovered Revenue calculation |

---

## 8. Capability Gaps, Risks, and Mitigations

| Identified Gap / Risk | Architectural Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **No Live Validation Logs Yet** | Capabilities are documented but lack empirical test execution evidence in repo. | Execute Phase 1 integration tests with Razorpay Test API keys to transition `REQUIRED-UNVALIDATED` to `VALIDATED`. |
| **Webhook Delivery Latency / Out of Order** | Webhook for link payment might arrive before link creation DB transaction commits. | Store incoming webhooks in raw `WebhookEvent` table first; process asynchronously with exponential retry backoff. |
| **`reference_id` Uniqueness Constraint** | Retrying Payment Link creation with same `reference_id` throws HTTP 400. | Append attempt suffix to reference ID: `RRE_OPP_<id>_ATT_<count>` (ensuring total length $\le 40$ chars). |
| **Duplicate Webhook Delivery** | Same `payment.failed` event delivered multiple times could create duplicate opportunities. | Maintain atomic database unique index on `(provider_event_id)` and `(source_transaction_id)`. |
| **Test Mode SMS/Email Non-Delivery** | Real SMS/Emails are not dispatched in Razorpay sandbox mode. | Extract `short_url` from API response and render directly in RRE Control Tower UI for manual/automated demonstration testing. |

---

## 9. Capability Mapping to Implementation Strategy Phases

Traceability matrix connecting capabilities to implementation phases in `IMPLEMENTATION_STRATEGY.md`:

```text
Phase 1: Foundation & Integration Layer
├── CAP-AUTH-01 (Basic Auth API Access)
├── CAP-AUTH-02 (Webhook HMAC SHA-256 Signature Verification)
├── CAP-ORD-01  (Orders API Creation)
├── CAP-EVT-01  (payment.failed Webhook Ingestion)
├── CAP-EVT-03  (payment.captured Webhook Ingestion)
└── CAP-EVT-04  (payment_link.paid Webhook Ingestion)

Phase 2: Core Intelligence & Recovery Workflow (Primary Vertical Slice)
├── CAP-ERR-01  (Razorpay Error Taxonomy Parser)
├── CAP-ACT-01  (Payment Links API Execution)
└── CAP-EVT-05  (payment_link.cancelled/expired Handling)

Phase 3: Extended Vectors & Analytics (Post-MVP)
├── CAP-ORD-02  (Fetch Order API / Abandonment Polling)
├── CAP-ACT-02  (Payment Capture API)
├── CAP-SUB-01  (Subscriptions Engine Events) [DEFERRED]
└── CAP-SUB-02  (Invoice Retry API) [DEFERRED]
```

---

## 10. MVP Capability Lock

### 10.1 Safe Dependencies (Approved for Building)

The RRE implementation team is safe to build against the following **Razorpay Test API & Webhook Boundary**:

1. **Authentication**: Basic HTTP Auth with `rzp_test_...` key/secret pairs.
2. **Security**: Signature validation using `HMAC-SHA256` with `X-Razorpay-Signature`.
3. **Event Ingestion**: Asynchronous consumption of `payment.failed` and `payment_link.paid`.
4. **Diagnosis**: Error taxonomy mapping over `error.source`, `error.step`, `error.reason`, and `error.code`.
5. **Recovery Action Execution**: `POST /v1/payment_links` using `reference_id` (capped at 40 chars) and `notes`.
6. **Correlation & Verification**: Strict exact-string matching on `reference_id` from `payment_link.paid` payload, verifying `amount` in minor units before updating revenue ledger.

### 10.2 Explicit Prohibitions (Do Not Depend On)

1. **Do NOT depend on private internal gateway routing controls or real-time issuer queue depth APIs.**
2. **Do NOT depend on direct 3DS authentication overrides.**
3. **Do NOT depend on fuzzy matching (amount + timestamp) for payment verification.**
4. **Do NOT depend on automatic live SMS/Email dispatch in Test Mode for demo verification; always use returned `short_url`.**
5. **Do NOT claim financial recovery without verified receipt of `payment_link.paid` or `payment.captured` webhooks.**

---
*End of Capability Matrix Document.*
