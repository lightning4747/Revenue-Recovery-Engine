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
├── docker-compose.yml       # Local PostgreSQL 15, Redis 7 & Backend services
└── package.json
```

## Quick Start & Development Workflows

### Option A: Full Docker Compose Environment (All Services)
Runs PostgreSQL, Redis, and Backend inside Docker containers:
```bash
# 1. Start all Docker containers (PostgreSQL, Redis, Backend on port 3000)
docker compose up -d

# 2. Start zrok local webhook tunnel (Do NOT run pnpm start:dev when container is running)
pnpm tunnel
```

### Option B: Local Host Development Mode (With Live Reloading)
Runs PostgreSQL & Redis in Docker, and NestJS locally on host for active development:
```bash
# 1. Start Database & Redis containers only
docker compose up -d postgres redis

# 2. Start Backend locally with watch mode
pnpm start:dev

# 3. In a second terminal, start zrok local webhook tunnel
pnpm tunnel
```

For complete step-by-step setup instructions, refer to **[`docs/LOCAL_WEBHOOK_INGRESS.md`](docs/LOCAL_WEBHOOK_INGRESS.md)**.

## Test Suites

```bash
# Unit Tests
pnpm test

# End-to-End Integration Tests
pnpm test:e2e
```
