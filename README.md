# Revenue Recovery Engine (RRE)

Microservice backend engine for automated payment failure diagnosis, ERV calculation, policy validation, and recovery orchestration.

## Repository Structure

Monorepo workspace managed via `pnpm`:

```text
.
├── apps/
│   └── backend/             # NestJS microservice application
│       ├── scripts/
│       │   └── zrok-tunnel.sh # Local developer webhook ingress script
│       └── src/
│           ├── auth/        # Merchant signup, login, JWT, AES-256-GCM crypto
│           ├── database/    # Drizzle ORM PostgreSQL domain schemas
│           ├── merchant/    # Merchant credentials management
│           └── razorpay/    # Webhook ingestion engine & HMAC verification
├── docs/                    # Project specifications & architecture docs
│   └── LOCAL_WEBHOOK_INGRESS.md # Local zrok webhook ingress developer guide
├── docker-compose.yml       # Local PostgreSQL 15 & Redis 7 services
└── package.json
```

## Quick Start & Development Commands

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start PostgreSQL Infrastructure
```bash
docker compose up -d rre-postgres
```

### 3. Start Backend Application (Dev Mode)
```bash
pnpm start:dev
```

### 4. Local Webhook Ingress (zrok)
To receive test webhooks from Razorpay on `localhost` during development:
```bash
pnpm tunnel
```
For complete step-by-step setup instructions, refer to **[`docs/LOCAL_WEBHOOK_INGRESS.md`](docs/LOCAL_WEBHOOK_INGRESS.md)**.

### 5. Run Test Suites
```bash
# Unit Tests
pnpm test

# End-to-End Integration Tests
pnpm test:e2e
```
