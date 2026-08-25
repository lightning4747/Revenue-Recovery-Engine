# PHASE 09 — Dynamic Recovery Action Layer (Razorpay Payment Links)

## 1. Purpose
Implement the Razorpay REST API Client Adapter, per-attempt `reference_id` generation (`opp_<id>_att_<n>`, $\le 40$ chars), structured `notes` metadata payload (`opportunity_id`, `original_order_id`, `original_payment_id`), Payment Link dispatch (`POST /v1/payment_links`), `lastPaymentLinkUrl` (`short_url`) persistence, and Control Tower Test Mode UI link launch button rendering.

Executing a dynamic Payment Link API call against Razorpay is the primary recovery vector for the MVP. Razorpay Payment Links create an internal order (`order_new...`), require per-attempt unique `reference_id` capped at 40 chars (CRIT-02), and suppress real SMS/WhatsApp in Test Mode. Persisting `short_url` and rendering a launch button in the UI enables end-to-end sandbox testing (HIGH-04).

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 11 (*FR-017 Action Execution via API* & *FR-018 Dynamic Payment Links*): Generating dynamic Payment Links via Razorpay REST API.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 7 (*Razorpay Integration Layer*): Isolated internal API client adapter pattern.
  * Section 18 (*Recovery Action Layer*) & Section 18.1 (*Payment Link Creation & Correlation Specification*): Disconnected Order entity rules, per-attempt `reference_id` formatting (`opp_<id>_att_<n>`, $\le 40$ chars), structured `notes` metadata payload, exact API payload, entity persistence rules (CRIT-02), and Test Mode UI `short_url` launch button specification (HIGH-04).
* **[`RAZORPAY_CAPABILITY_MATRIX.md`](../../docs/RAZORPAY_CAPABILITY_MATRIX.md)**:
  * Section 1 (*Payment Links API*): Endpoint specs (`POST /v1/payment_links`), `accept_partial: true`, `reference_id` uniqueness, and Test Mode constraints.
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 2 & CRIT-02, HIGH-04: Payment Link correlation semantics and Test Mode URL display.

---

## 3. Prerequisites / Dependencies
* **PHASE-03 (Auth & Credentials)**: Requires decrypted merchant Razorpay credentials (`keyId`, `encryptedKeySecret`).
* **PHASE-08 (Policy Gating)**: Requires policy-approved opportunities in `PRIORITIZED` state and `pnpm` package manager.

---

## 4. Scope
* **Razorpay REST API Client Adapter**:
  * Implement authenticated HTTP client using Basic Auth (`keyId:keySecret`).
* **Per-Attempt Reference ID Generator (CRIT-02)**:
  * Format: `reference_id = "opp_" + shortId + "_att_" + attemptCount` (Length: $\le 40$ characters).
* **Structured Notes Metadata Payload (CRIT-02)**:
  * Pass `notes: { opportunity_id, original_order_id, original_payment_id, merchant_id }`.
* **Payment Link Creation Endpoint (`POST /v1/payment_links`)**:
  * Execute API request with `amount` (paise), `currency`, `accept_partial: true`, `reference_id`, `notes`.
* **Action Persistence & State Transition**:
  * On success response: Increment `attemptCount` by 1, store `lastReferenceId`, `lastPaymentLinkId`, `lastPaymentLinkUrl` (`short_url`), and transition `status` $\rightarrow$ `'ACTION_DISPATCHED'`.
* **Test Mode UI Link Launch Support (HIGH-04)**:
  * Expose `lastPaymentLinkUrl` via REST API so Control Tower UI renders "Test Mode: Launch Payment Link" button for live sandbox verification.

---

## 5. Technical Implementation Requirements
1. **Razorpay REST API Adapter**:
   * Add HTTP client dependency via `pnpm`: `pnpm add @nestjs/axios axios`.
   * Create `RazorpayApiClientService`:
     - Method `createPaymentLink(merchantCredentials, payload)` sending HTTP `POST` to `https://api.razorpay.com/v1/payment_links`.
     - Handles 4xx/5xx Razorpay API errors cleanly.
2. **Payment Link Recovery Action Processor**:
   * Create `PaymentLinkActionService`:
     - Generates per-attempt `reference_id`:
       `const referenceId = `${opportunity.id}_att_${opportunity.attemptCount + 1}`;` (Ensures length $\le 40$ chars).
     - Constructs API payload:
       ```json
       {
         "amount": 1000000,
         "currency": "INR",
         "accept_partial": true,
         "reference_id": "opp_01H8X_att_1",
         "description": "Recovery link for Order #order_456",
         "notes": {
           "opportunity_id": "opp_01H8X",
           "original_order_id": "order_456",
           "original_payment_id": "pay_123",
           "merchant_id": "m_01H8X"
         }
       }
       ```
     - Calls `RazorpayApiClientService`.
     - On HTTP 200/201 response: Updates `RecoveryOpportunity` (`attemptCount += 1`, `lastReferenceId = response.reference_id`, `lastPaymentLinkId = response.id`, `lastPaymentLinkUrl = response.short_url`, `status = 'ACTION_DISPATCHED'`).
     - Logs audit event with `userExplanation` and `technicalSnapshot`.

---

## 6. Files / Modules / Components Affected
```text
apps/backend/src/
├── razorpay/
    ├── client/
    │   └── razorpay-api-client.service.ts
    └── payment-links/
        ├── payment-links.module.ts
        └── payment-link-action.service.ts
```

---

## 7. Interfaces / Data / Integration Requirements
* **External API Integration**: Invokes Razorpay API `POST /v1/payment_links`.
* **Database Updates**: Updates `recovery_opportunities` (`attempt_count`, `last_reference_id`, `last_payment_link_id`, `last_payment_link_url`, `status = 'ACTION_DISPATCHED'`). Inserts audit record into `audit_events`.

---

## 8. Acceptance Criteria
* Dispatching a recovery action generates a `reference_id` strictly $\le 40$ characters.
* API payload contains structured `notes` with `opportunity_id` and `original_order_id`.
* Executing action against Razorpay Test API returns HTTP 200/201 with `id` (`plink_...`) and `short_url` (`https://rzp.io/i/xyz`).
* `lastPaymentLinkUrl` is persisted in PostgreSQL, and opportunity `status` transitions to `'ACTION_DISPATCHED'`.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * `reference_id` length and format compliance ($\le 40$ characters).
  * Structured `notes` metadata composition.
  * Basic Auth header construction using decrypted merchant credentials.
  * Razorpay API error response handling (4xx/5xx).
  * State transition to `ACTION_DISPATCHED` and `short_url` persistence.
* **Verification Scope**: Unit tests for reference generator and payload builder; integration test sending request to Razorpay Test Mode API sandbox (`rzp_test_...`).

---

## 10. Definition of Done
* Razorpay Payment Link action processor operational, dispatching test links against Razorpay sandbox, persisting `short_url`, and setting `status = 'ACTION_DISPATCHED'` with passing tests executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* Automated SMS/WhatsApp gateway integrations outside Razorpay native channels.
* Multiple concurrent recovery action types for MVP (sticking strictly to Payment Links).

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
