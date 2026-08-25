# PHASE 11 — Control Tower Dashboard & Audit UI Subsystem

## 1. Purpose
Implement the Control Tower REST API endpoints, Executive Summary financial metrics, Opportunity Queue pagination and filtering, Audit Timeline inspection views, and the React/Vite single-page frontend interface rendering live metrics and the Test Mode payment link launch button.

A merchant-facing Control Tower UI and immutable audit trail (FR-023 through FR-032) allows merchants and hackathon judges to inspect real-time recovery performance (`Revenue at Risk`, `Verified Recovered`), examine detailed opportunity state timelines, review sanitized explanations (MED-03), and launch test payment links (HIGH-04).

---

## 2. Source Documentation

### Authoritative Project Specifications
* **[`FUNCTIONAL_REQUIREMENTS.md`](../../docs/FUNCTIONAL_REQUIREMENTS.md)**:
  * Section 13 (*FR-023 to FR-028 Dashboard Summary & Analytics*): Executive View financial metrics and opportunity queue.
  * Section 16 (*FR-030 to FR-032 Explainability & Audit Trail UI*): Audit trail timeline and decision inspection views.
* **[`IMPLEMENTATION_STRATEGY.md`](../../docs/IMPLEMENTATION_STRATEGY.md)**:
  * Section 21 (*Audit Architecture*) & Section 21.1 (*Audit Field Separation & Security Policy*): `userExplanation` sanitized narrative strings vs. `technicalSnapshot` JSONB metadata rules (MED-03).
  * Section 22 (*Dashboard Architecture*): Executive Summary metric calculation formulas (`revenueAtRisk = sum(remainingAmount)`, `verifiedRecovered = sum(recoveredAmount)`).
* **[`IMPLEMENTATION_FEASIBILITY_REVIEW.md`](../../docs/IMPLEMENTATION_FEASIBILITY_REVIEW.md)**:
  * Section 2 & MED-03, HIGH-04: Control Tower UI Test Mode link launch button and audit explanation separation rules.

---

## 3. Prerequisites / Dependencies
* **PHASE-03 (Auth)**: Requires merchant JWT authentication.
* **PHASE-10 (Verification)**: Requires verified opportunity and payment ledger data and `pnpm` package manager.

---

## 4. Scope
* **Control Tower REST API Endpoints**:
  * `GET /api/v1/dashboard/summary`: Executive metrics (`revenueAtRisk`, `expectedRecoverable`, `verifiedRecovered`, `activeOpportunitiesCount`, `recoveryRatePercentage`).
  * `GET /api/v1/dashboard/opportunities`: Paginated opportunity queue with status filters.
  * `GET /api/v1/dashboard/opportunities/:id`: Detailed opportunity view.
  * `GET /api/v1/dashboard/audit-trail/:id`: Immutable audit event timeline.
* **React/Vite Single-Page Application**:
  * Metric summary cards (`Revenue at Risk`, `Verified Recovered`).
  * Opportunity Queue table displaying canonical status badges and priority scores.
  * Opportunity detail modal displaying timeline steps, sanitized `userExplanation`, and **"Test Mode: Launch Payment Link"** button for active links (`short_url`).
  * Audit timeline component rendering decision history.

---

## 5. Technical Implementation Requirements
1. **Dashboard Controller & Service**:
   * Create `DashboardController` & `DashboardService`:
     - `getSummary(merchantId)`: Aggregates sums from `recovery_opportunities` and `recovery_payments`:
       * `revenueAtRisk` = $\sum \text{remainingAmount}$ for active/partially recovered opportunities.
       * `verifiedRecovered` = $\sum \text{recoveredAmount}$ across all opportunities.
       * `recoveryRate` = $(\text{verifiedRecovered} / (\text{verifiedRecovered} + \text{revenueAtRisk})) \times 100$.
     - `getOpportunities(merchantId, query)`: Returns paginated opportunities with state filters.
     - `getAuditTrail(merchantId, opportunityId)`: Returns `userExplanation` and `timestamp` records from `audit_events`.
2. **React/Vite Frontend Application**:
   * Set up React + Vite project in `frontend/` directory using `pnpm`: `pnpm create vite frontend --template react-ts`.
   * Install frontend dependencies via `pnpm`: `pnpm add axios lucide-react`.
   * Implement UI Components:
     - `ExecutiveSummaryCards`: Displays financial metrics converted from paise to formatted ₹ INR.
     - `OpportunityQueueTable`: Displays opportunities with canonical status pills (`OBSERVED`, `ACTION_DISPATCHED`, `PARTIALLY_RECOVERED`, `RECOVERED`, etc.).
     - `TestModeLinkButton`: Renders `<a href={lastPaymentLinkUrl} target="_blank">` button for active links.
     - `AuditTimelineModal`: Renders step-by-step decision history.

---

## 6. Files / Modules / Components Affected
```text
src/
└── dashboard/
    ├── dashboard.module.ts
    ├── dashboard.controller.ts
    └── dashboard.service.ts

frontend/
├── index.html
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── ExecutiveSummaryCards.tsx
│   │   ├── OpportunityQueueTable.tsx
│   │   ├── OpportunityDetailModal.tsx
│   │   └── AuditTimeline.tsx
│   └── services/
│       └── api.ts
├── package.json
└── pnpm-lock.yaml
```

---

## 7. Interfaces / Data / Integration Requirements
* **API Endpoints**:
  * `GET /api/v1/dashboard/summary` (Authenticated).
  * `GET /api/v1/dashboard/opportunities` (Authenticated).
  * `GET /api/v1/dashboard/opportunities/:id` (Authenticated).
  * `GET /api/v1/dashboard/audit-trail/:id` (Authenticated).
* **Database Access**: Read-only queries against `recovery_opportunities`, `recovery_payments`, and `audit_events` scoped by `WHERE merchant_id = :merchantId`.

---

## 8. Acceptance Criteria
* `GET /api/v1/dashboard/summary` returns correct sums in integer paise and calculated recovery rate percentage.
* Navigating to the frontend dashboard displays live metrics and opportunity queue.
* Clicking on an opportunity in `ACTION_DISPATCHED` state displays the **"Test Mode: Launch Payment Link"** button with valid `short_url`.
* Opening the audit modal displays clean, sanitized `userExplanation` strings without exposing technical JSON snapshots, credentials, or raw LLM prompts.

---

## 9. Verification Requirements
* **Behaviors to Verify**:
  * Financial metric aggregation formulas accuracy (`revenueAtRisk`, `verifiedRecovered`).
  * `userExplanation` audit string retrieval without leaking internal technical snapshots or credentials.
  * `lastPaymentLinkUrl` retrieval and button rendering for active links.
  * Authentication token header propagation from frontend API client.
* **Verification Scope**: Unit tests for dashboard service; integration REST API tests for dashboard endpoints.

---

## 10. Definition of Done
* Control Tower REST APIs and React frontend dashboard operational, displaying live metrics, opportunity queues, audit timelines, and test link buttons with passing tests executed via `pnpm`.

---

## 11. Explicitly Out of Scope
* Real-time WebSocket or SSE push updates for MVP (polling interval is sufficient).
* Exporting reports to PDF/CSV.

---

## 12. Phase Completion Artifacts
Upon phase completion, this directory will contain:
* `PHASE.md`
* `TESTING_STRATEGY.md`
* `VERIFICATION_REPORT.md`
