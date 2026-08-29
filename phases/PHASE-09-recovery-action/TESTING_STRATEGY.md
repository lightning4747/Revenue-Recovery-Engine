# Phase 09 Testing Strategy: Dynamic Recovery Action Layer (Razorpay Payment Links)

## Overview
This document outlines the testing strategy for verifying Phase 09: Dynamic Recovery Action Layer (Razorpay Payment Links). The testing hierarchy covers unit testing of the Razorpay REST API adapter, per-attempt reference ID generation, structured notes metadata construction, payment link short URL persistence, and end-to-end integration tests.

---

## 1. Scope & Test Objectives
- **Razorpay REST API Adapter (`RazorpayApiClientService`)**: Verify HTTP `POST /v1/payment_links` request formatting using HTTP Basic Auth (`keyId:keySecret`), response parsing, and 4xx/5xx API error handling.
- **Per-Attempt Reference ID & Payload Builder (`PaymentLinkActionService`)**: Verify `reference_id` generation (`opp_<id>_att_<n>`, $\le 40$ chars), structured `notes` metadata (`opportunity_id`, `original_order_id`, `original_payment_id`, `merchant_id`), `attemptCount` increment, `lastPaymentLinkUrl` (`short_url`) persistence, and state transition to `'ACTION_DISPATCHED'`.
- **Test Mode UI Link Launch Support (HIGH-04)**: Verify `last_payment_link_url` (`https://rzp.io/i/...`) persistence to support sandbox link launching in the Control Tower UI.
- **End-to-End Integration (`app.e2e-spec.ts`)**: Verify seamless status transition from webhook ingestion through policy approval and payment link creation in PostgreSQL.

---

## 2. Test Execution Commands
```bash
# Unit Tests
pnpm --filter backend test src/razorpay/client/
pnpm --filter backend test src/razorpay/payment-links/

# All Backend Unit Tests
pnpm --filter backend test

# End-to-End Integration Tests
pnpm test:e2e
```
