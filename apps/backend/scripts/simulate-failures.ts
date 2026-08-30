import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { URL } from 'url';

// Load .env file automatically
function loadEnvFile() {
  const envPaths = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/backend/.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

loadEnvFile();

const port = process.env.PORT || '3000';
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const countArg = process.argv.find((a) => a.startsWith('--count='));
const totalCount = countArg ? parseInt(countArg.split('=')[1], 10) : 10;
const isRecoverMode = process.argv.includes('--recover');
const isFlowMode = process.argv.includes('--flow');

function sendHttpRequest(
  targetUrl: string,
  method: string,
  body?: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body, 'utf8').toString();
    }

    const req = transport.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers,
      },
      (res) => {
        let responseData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
            body: responseData,
          }),
        );
      },
    );

    req.on('error', (err) => reject(err));
    if (body) req.write(body, 'utf8');
    req.end();
  });
}

const FAILURE_SCENARIOS = [
  {
    reason: 'customer_auth_timeout',
    source: 'issuer',
    step: 'payment_authorization',
    code: 'BAD_REQUEST_ERROR',
    description: 'Customer failed to submit 3DS OTP within 180 seconds',
    minAmount: 150000,
    maxAmount: 450000,
  },
  {
    reason: 'insufficient_funds',
    source: 'issuer',
    step: 'payment_authorization',
    code: 'BAD_REQUEST_ERROR',
    description: 'Transaction declined due to insufficient balance in account',
    minAmount: 250000,
    maxAmount: 750000,
  },
  {
    reason: 'bank_downtime',
    source: 'bank',
    step: 'payment_processing',
    code: 'GATEWAY_ERROR',
    description: 'Issuing bank core banking network temporarily unavailable',
    minAmount: 500000,
    maxAmount: 1200000,
  },
  {
    reason: 'expired_card',
    source: 'issuer',
    step: 'payment_authorization',
    code: 'BAD_REQUEST_ERROR',
    description: 'Card validity expired prior to authorization request',
    minAmount: 120000,
    maxAmount: 380000,
  },
  {
    reason: 'gateway_degradation',
    source: 'gateway',
    step: 'payment_processing',
    code: 'GATEWAY_TIMEOUT',
    description: 'Acquiring gateway latency exceeded SLA timeout of 5000ms',
    minAmount: 800000,
    maxAmount: 2500000,
  },
  {
    reason: 'card_invalid',
    source: 'issuer',
    step: 'payment_authorization',
    code: 'BAD_REQUEST_ERROR',
    description: 'Invalid card number or stolen card flag reported by issuing network',
    minAmount: 50000,
    maxAmount: 180000,
  },
];

async function resolveMerchantAndSecret(): Promise<{ merchantId: string; webhookSecret: string; accessToken: string }> {
  const defaultSecret = process.env.WEBHOOK_SECRET || 'bow_webhook_secret_123';
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TVsCTwvJZE0JqB';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'YN2yrJLEyHY51aa7dOZV8eVx';
  const cleanBase = baseUrl.replace(/\/$/, '');

  try {
    const loginRes = await sendHttpRequest(
      `${cleanBase}/api/v1/auth/login`,
      'POST',
      JSON.stringify({ email: 'merchant@example.com', password: 'password123' }),
    );

    if (loginRes.statusCode === 200) {
      const parsed = JSON.parse(loginRes.body);
      const accessToken = parsed?.data?.accessToken || parsed?.accessToken;
      if (accessToken) {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          const merchantId = decoded.sub;

          // Ensure merchant credentials in DB are synced to authentic Razorpay keys
          await sendHttpRequest(
            `${cleanBase}/api/v1/merchant/credentials`,
            'PUT',
            JSON.stringify({
              keyId,
              keySecret,
              webhookSecret: defaultSecret,
            }),
            { Authorization: `Bearer ${accessToken}` },
          );

          return { merchantId, webhookSecret: defaultSecret, accessToken };
        }
      }
    }
  } catch (err: any) {
    console.error(`Login error in simulator: ${err?.message}`);
  }

  return { merchantId: 'm_default_merchant', webhookSecret: defaultSecret, accessToken: '' };
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function injectSingleFailure(index: number, total: number, merchantId: string, webhookSecret: string, cleanBase: string): Promise<boolean> {
  const targetEndpoint = `${cleanBase}/api/v1/webhooks/razorpay/${merchantId}`;
  const scenario = FAILURE_SCENARIOS[index % FAILURE_SCENARIOS.length];
  const amountPaise = getRandomInt(scenario.minAmount, scenario.maxAmount);
  const amountRupees = (amountPaise / 100).toFixed(2);
  const eventId = `evt_sim_${Date.now()}_${index}_${crypto.randomBytes(4).toString('hex')}`;
  const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
  const orderId = `order_${crypto.randomBytes(6).toString('hex')}`;

  const payloadObj = {
    entity: 'event',
    account_id: 'acc_sim_live_99',
    event: 'payment.failed',
    event_id: eventId,
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          entity: 'payment',
          amount: amountPaise,
          currency: 'INR',
          status: 'failed',
          order_id: orderId,
          method: index % 2 === 0 ? 'card' : 'upi',
          description: `Automated Recovery Simulation Order #${1000 + index}`,
          error_code: scenario.code,
          error_description: scenario.description,
          error_source: scenario.source,
          error_step: scenario.step,
          error_reason: scenario.reason,
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  const rawBody = JSON.stringify(payloadObj);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  try {
    const res = await sendHttpRequest(targetEndpoint, 'POST', rawBody, {
      'X-Razorpay-Signature': signature,
      'X-Razorpay-Event-Id': eventId,
    });

    if (res.statusCode === 200) {
      console.log(`[${index}/${total}] 🔴 INJECTED FAILURE ₹${amountRupees} | Reason: ${scenario.reason} | Order ID: ${orderId}`);
      return true;
    } else {
      console.log(`[${index}/${total}] ✗ Failed with HTTP ${res.statusCode}: ${res.body}`);
      return false;
    }
  } catch (err: any) {
    console.error(`[${index}/${total}] ✗ Connection error: ${err.message}`);
    return false;
  }
}

async function recoverOpenOpportunities(merchantId: string, webhookSecret: string, accessToken: string, cleanBase: string) {
  const targetEndpoint = `${cleanBase}/api/v1/webhooks/razorpay/${merchantId}`;
  const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const oppsRes = await sendHttpRequest(
    `${cleanBase}/api/v1/dashboard/opportunities?limit=50`,
    'GET',
    undefined,
    headers,
  );

  if (oppsRes.statusCode !== 200) return;

  const allOpps = JSON.parse(oppsRes.body)?.data?.data || [];
  const oppsData = allOpps.filter((o: any) => o.status === 'ACTION_DISPATCHED' || o.status === 'PRIORITIZED');

  for (let i = 0; i < oppsData.length; i++) {
    const opp = oppsData[i];
    const eventId = `evt_rec_${Date.now()}_${i + 1}`;
    const paymentId = `pay_recovered_${crypto.randomBytes(6).toString('hex')}`;
    const referenceId = opp.lastReferenceId || `${opp.id.substring(0, 24)}_att_1`;
    const paymentLinkId = opp.lastPaymentLinkId || `plink_${crypto.randomBytes(6).toString('hex')}`;

    const payloadObj = {
      entity: 'event',
      account_id: 'acc_sim_recover_99',
      event: 'payment_link.paid',
      event_id: eventId,
      contains: ['payment_link', 'payment'],
      payload: {
        payment_link: {
          entity: {
            id: paymentLinkId,
            entity: 'payment_link',
            amount: opp.amount,
            amount_paid: opp.amount,
            status: 'paid',
            reference_id: referenceId,
            notes: {
              opportunity_id: opp.id,
              merchant_id: merchantId,
            },
          },
        },
        payment: {
          entity: {
            id: paymentId,
            entity: 'payment',
            amount: opp.amount,
            currency: opp.currency || 'INR',
            status: 'captured',
            method: 'netbanking',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawBody = JSON.stringify(payloadObj);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const res = await sendHttpRequest(targetEndpoint, 'POST', rawBody, {
      'X-Razorpay-Signature': signature,
      'X-Razorpay-Event-Id': eventId,
    });

    if (res.statusCode === 200) {
      console.log(`🟢 RECOVERED PAYMENT ₹${(opp.amount / 100).toFixed(2)} | Opportunity: ${opp.id.substring(0, 16)}... | Status: RECOVERED`);
    }
  }
}

async function runSimulation() {
  const { merchantId, webhookSecret, accessToken } = await resolveMerchantAndSecret();
  const cleanBase = baseUrl.replace(/\/$/, '');

  if (isFlowMode) {
    console.log('\n==========================================================================');
    console.log('  REVENUE RECOVERY ENGINE — REAL-TIME CONCURRENT FLOW SIMULATOR');
    console.log('  Simulating continuous real-world stream: Payment Failures & AI Recoveries');
    console.log('==========================================================================\n');

    for (let i = 1; i <= totalCount; i++) {
      console.log(`--- [Cycle ${i}/${totalCount}] ---`);
      await injectSingleFailure(i, totalCount, merchantId, webhookSecret, cleanBase);
      await new Promise((r) => setTimeout(r, 600));
      await recoverOpenOpportunities(merchantId, webhookSecret, accessToken, cleanBase);
      await new Promise((r) => setTimeout(r, 600));
    }

    console.log('\n==========================================================================');
    console.log('  REAL-TIME FLOW SIMULATION COMPLETE: All failures and recoveries processed.');
    console.log('  Open your local dashboard (http://localhost:5173) and click REFRESH!');
    console.log('==========================================================================\n');
    return;
  }

  if (isRecoverMode) {
    console.log('\n==========================================================================');
    console.log('  REVENUE RECOVERY ENGINE — AUTOMATED RECOVERY SETTLEMENT SIMULATOR');
    console.log('==========================================================================');
    await recoverOpenOpportunities(merchantId, webhookSecret, accessToken, cleanBase);
    console.log('\n==========================================================================');
    console.log('  RECOVERY SIMULATION COMPLETE. Refresh your dashboard (http://localhost:5173)');
    console.log('==========================================================================\n');
    return;
  }

  console.log('\n==========================================================================');
  console.log('  REVENUE RECOVERY ENGINE — AUTOMATED FAILURE SIMULATOR');
  console.log('==========================================================================');
  for (let i = 1; i <= totalCount; i++) {
    await injectSingleFailure(i, totalCount, merchantId, webhookSecret, cleanBase);
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log('\n==========================================================================');
  console.log('  FAILURE SIMULATION COMPLETE: To recover open opportunities, run: pnpm simulate:recover');
  console.log('  Or to run real-time concurrent stream, run: pnpm simulate:flow');
  console.log('==========================================================================\n');
}

runSimulation();
