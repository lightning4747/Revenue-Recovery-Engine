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
const mode = process.argv.includes('--recover') ? 'RECOVER' : 'FAILURES';

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
];

async function resolveMerchantAndSecret(): Promise<{ merchantId: string; webhookSecret: string }> {
  const defaultSecret = process.env.WEBHOOK_SECRET || 'bow_webhook_secret_123';
  const cleanBase = baseUrl.replace(/\/$/, '');

  try {
    const loginRes = await sendHttpRequest(
      `${cleanBase}/api/v1/auth/login`,
      'POST',
      JSON.stringify({ email: 'merchant@example.com', password: 'password123' }),
    );

    if (loginRes.statusCode === 200) {
      const parsed = JSON.parse(loginRes.body);
      const accessToken = parsed?.data?.accessToken;
      if (accessToken) {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          const merchantId = decoded.sub;

          await sendHttpRequest(
            `${cleanBase}/api/v1/merchant/credentials`,
            'PUT',
            JSON.stringify({
              keyId: 'rzp_test_default_key',
              keySecret: 'dummy_key_secret',
              webhookSecret: defaultSecret,
            }),
            { Authorization: `Bearer ${accessToken}` },
          );

          return { merchantId, webhookSecret: defaultSecret };
        }
      }
    }
  } catch {
    // Fallback
  }

  return { merchantId: 'm_default_merchant', webhookSecret: defaultSecret };
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runBulkSimulation() {
  console.log('\n==========================================================================');
  console.log('  REVENUE RECOVERY ENGINE — AUTOMATED BULK SIMULATOR');
  console.log('==========================================================================');
  console.log(`  Count to Generate: ${totalCount} simulated events`);
  console.log(`  Target Backend:    ${baseUrl}`);

  const { merchantId, webhookSecret } = await resolveMerchantAndSecret();
  const targetEndpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/webhooks/razorpay/${merchantId}`;

  console.log(`  Merchant ID:       ${merchantId}`);
  console.log(`  Webhook Secret:    ${webhookSecret}`);
  console.log('==========================================================================\n');

  let successCount = 0;

  for (let i = 1; i <= totalCount; i++) {
    const scenario = FAILURE_SCENARIOS[i % FAILURE_SCENARIOS.length];
    const amountPaise = getRandomInt(scenario.minAmount, scenario.maxAmount);
    const amountRupees = (amountPaise / 100).toFixed(2);
    const eventId = `evt_bulk_${Date.now()}_${i}_${crypto.randomBytes(4).toString('hex')}`;
    const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
    const orderId = `order_${crypto.randomBytes(6).toString('hex')}`;

    const payloadObj = {
      entity: 'event',
      account_id: 'acc_bulk_sim_99',
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
            method: i % 2 === 0 ? 'card' : 'upi',
            description: `Automated Simulation Order #${1000 + i}`,
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
        successCount++;
        console.log(
          `[${i}/${totalCount}] ✓ Generated ₹${amountRupees} failure | Reason: ${scenario.reason} | Event ID: ${eventId}`,
        );
      } else {
        console.log(`[${i}/${totalCount}] ✗ Failed with HTTP ${res.statusCode}: ${res.body}`);
      }
    } catch (err: any) {
      console.error(`[${i}/${totalCount}] ✗ Connection error: ${err.message}`);
    }

    // Small delay to simulate realistic traffic arrival
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log('\n==========================================================================');
  console.log(`  SIMULATION COMPLETE: ${successCount}/${totalCount} events injected successfully.`);
  console.log('  Open your local dashboard (http://localhost:5173) and click REFRESH!');
  console.log('==========================================================================\n');
}

runBulkSimulation();
