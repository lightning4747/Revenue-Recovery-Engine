# Local Webhook Ingress & Testing Guide (zrok)

## 1. Overview
During local development, the NestJS backend application runs on `http://localhost:3000`. External payment gateway servers (e.g. Razorpay) cannot send HTTP POST webhook notifications directly to `localhost` or private local IP addresses.

To enable local end-to-end testing of Razorpay webhook delivery (`payment.failed`, `payment_link.paid`, etc.), we use **zrok** as local developer tooling. **zrok** exposes your local HTTP server port over a temporary, public HTTPS endpoint (`https://<hash>.share.zrok.io`).

> [!NOTE]
> **Developer Tooling Isolation**
> `zrok` is strictly a local development tool. It is NOT a production application dependency, Docker runtime dependency, or cloud infrastructure component. Production deployments use standard cloud ingress (e.g. AWS ALB, NGINX, Cloudflare).

---

## 2. Prerequisites & zrok Installation

### Step 1: Install zrok CLI
Install `zrok` using official installation instructions (see [https://docs.zrok.io](https://docs.zrok.io)):

* **macOS (Homebrew)**:
  ```bash
  brew install zrok
  ```
* **Linux (Official Script)**:
  ```bash
  bash -c "$(curl -sS https://zrok.io/install.sh)"
  ```
* **Windows (Scoop)**:
  ```bash
  scoop install zrok
  ```

### Step 2: Account Setup & Environment Activation
1. Sign up for a free account at [https://zrok.io](https://zrok.io).
2. Obtain your user enable token from the zrok web console.
3. Enable your local machine environment:
   ```bash
   zrok enable <your_user_token>
   ```

---

## 3. End-to-End Local Development Workflows

You can run the backend microservice in one of two ways. Choose the setup mode that fits your development workflow:

---

### Option A: Full Docker Compose Setup (Backend Running in Container)

Use this option if you want Docker to run all services (PostgreSQL, Redis, and Backend):

1. **Start all Docker services**:
   ```bash
   docker compose up -d
   ```
   *(This starts `rre-postgres`, `rre-redis`, and `rre-backend` container mapped to host port `3000`)*

2. **Start zrok Tunnel**:
   > [!WARNING]
   > Do **NOT** run `pnpm start:dev` when running `docker compose up`. The backend is already running inside the Docker container on port 3000. Running `pnpm start:dev` on the host will cause `EADDRINUSE: address already in use :::3000`.

   Run the tunnel script:
   ```bash
   pnpm tunnel
   ```

---

### Option B: Local Host Development Setup (With Live Reloading)

Use this option if you want to edit code on your host machine with live NestJS reloading:

1. **Start Database & Redis Infrastructure Only**:
   ```bash
   docker compose up -d postgres redis
   ```

2. **Start NestJS Backend on Host**:
   In terminal window #1:
   ```bash
   pnpm start:dev
   ```
   *(Starts NestJS on host `http://localhost:3000` with watch mode enabled)*

3. **Start zrok Tunnel**:
   In terminal window #2:
   ```bash
   pnpm tunnel
   ```

---

## 4. Configuring & Testing Webhooks

### Step 1: Obtain Public URL & Construct Webhook Endpoint
When `pnpm tunnel` starts, it displays output similar to:
```text
==========================================================================
  REVENUE RECOVERY ENGINE — ZROK LOCAL WEBHOOK TUNNEL
==========================================================================
  Local Target:   http://localhost:3000
  Webhook Route:  /api/v1/webhooks/razorpay/<merchantId>
==========================================================================
  [+] public (frontend) share is at https://abcdef123456.share.zrok.io
```

1. Copy the public zrok URL (e.g. `https://abcdef123456.share.zrok.io`).
2. Construct your complete merchant webhook URL using your target `merchantId` (e.g. `m_12345`):
   ```text
   https://abcdef123456.share.zrok.io/api/v1/webhooks/razorpay/m_12345
   ```

### Step 2: Configure Webhook in Razorpay Test Dashboard
1. Log in to the [Razorpay Test Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **Add New Webhook**.
3. Set **Webhook URL** to your constructed endpoint: `https://<zrok-public-url>/api/v1/webhooks/razorpay/<merchantId>`.
4. Set **Secret** to your merchant's configured `webhookSecret` (must match the secret saved via `PUT /api/v1/merchant/credentials`).
5. Select active events to subscribe to:
   - `payment.failed`
   - `payment_link.paid`
   - `payment_link.partially_paid`
6. Save the webhook configuration.

### Step 3: Trigger Test Event & Verify Ingestion
1. In the Razorpay Test Dashboard or via Razorpay API test calls, trigger a test payment failure event.
2. Observe backend server logs (Docker logs or terminal window #1) to verify:
   - `X-Razorpay-Signature` validation succeeds against `req.rawBody`.
   - Log output: `WEBHOOK_PERSISTED: Successfully saved event evt_xxxx (payment.failed)`.
3. Verify event persistence in PostgreSQL:
   ```bash
   docker exec -it rre-postgres psql -U postgres -d rre_db -c "SELECT id, provider, provider_event_id, event_type, processing_status FROM webhook_events;"
   ```

---

## 5. Troubleshooting

* **`Error: listen EADDRINUSE: address already in use :::3000`**:
  You ran `pnpm start:dev` on host while the `rre-backend` Docker container was already running on port 3000.
  - Fix: If running `docker compose up -d`, do NOT run `pnpm start:dev` (just run `pnpm tunnel`).
  - Or to use `pnpm start:dev`: stop the backend container (`docker stop rre-backend`) or start only DB/Redis (`docker compose up -d postgres redis`).
* **`zrok command not found`**: Ensure `zrok` is installed and available in your `$PATH`.
* **`HTTP 400 Bad Request: Invalid webhook signature`**: Verify that the secret configured in Razorpay Test Dashboard matches the decrypted `webhookSecret` stored for `<merchantId>` in `merchant_credentials`.
* **`HTTP 400 Bad Request: Raw request body is required`**: Ensure `rawBody: true` remains set in NestJS `main.ts` initialization.
