import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { URL } from 'url';

// Load .env file automatically if process.env values not already set
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

// Helper to extract CLI flags (--key=value) or fallback to environment variables
function getOption(flagName: string, envName: string, fallback?: string): string | undefined {
  const prefix = `--${flagName}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) {
    return found.substring(prefix.length);
  }
  return process.env[envName] || fallback;
}

const port = process.env.PORT || '3000';
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const rawMerchantId = getOption('merchantId', 'MERCHANT_ID');
const rawWebhookSecret = getOption('webhookSecret', 'WEBHOOK_SECRET');
const scenario = (getOption('scenario', 'SCENARIO', 'valid') || 'valid').toLowerCase();
const eventId = getOption('eventId', 'EVENT_ID', `evt_local_${Date.now()}`)!;
const eventType = getOption('eventType', 'EVENT_TYPE', 'payment.failed')!;

// Helper to make generic HTTP requests
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

    const requestOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers,
    };

    const req = transport.request(requestOptions, (res) => {
      let responseData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 500,
          headers: res.headers,
          body: responseData,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(body, 'utf8');
    }
    req.end();
  });
}

// Generate realistic Razorpay payment.failed payload
function buildPayload(evId: string, evType: string): string {
  const payloadObj = {
    entity: 'event',
    account_id: 'acc_local_dev_123',
    event: evType,
    event_id: evId,
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: `pay_${crypto.randomBytes(6).toString('hex')}`,
          entity: 'payment',
          amount: 250000, // 2500.00 INR (in paise)
          currency: 'INR',
          status: 'failed',
          order_id: `order_${crypto.randomBytes(6).toString('hex')}`,
          invoice_id: null,
          international: false,
          method: 'card',
          amount_refunded: 0,
          refund_status: null,
          captured: false,
          description: 'Local Developer Test Payment Failure',
          card_id: `card_${crypto.randomBytes(6).toString('hex')}`,
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Payment failed due to insufficient funds in customer account',
          error_source: 'issuer',
          error_step: 'payment_authorization',
          error_reason: 'insufficient_funds',
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  return JSON.stringify(payloadObj, null, 2);
}

// Ensures a valid test merchant exists with configured webhook credentials if none provided
async function resolveMerchantAndSecret(): Promise<{ merchantId: string; webhookSecret: string }> {
  const defaultSecret = rawWebhookSecret || 'bow_webhook_secret_123';

  if (rawMerchantId) {
    return {
      merchantId: rawMerchantId,
      webhookSecret: defaultSecret,
    };
  }

  const cleanBase = baseUrl.replace(/\/$/, '');
  try {
    const loginRes = await sendHttpRequest(
      `${cleanBase}/api/v1/auth/login`,
      'POST',
      JSON.stringify({
        email: 'merchant@example.com',
        password: 'password123',
      }),
    );

    if (loginRes.statusCode === 200) {
      const parsed = JSON.parse(loginRes.body);
      const accessToken = parsed?.data?.accessToken;
      if (accessToken) {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          const merchantId = decoded.sub;

          // Upsert merchant credentials for logged in merchant account
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

          return {
            merchantId,
            webhookSecret: defaultSecret,
          };
        }
      }
    }
  } catch {
    // If backend connection fails, fallback
  }

  return {
    merchantId: 'm_default_merchant',
    webhookSecret: defaultSecret,
  };
}

// Main execution function
async function runTestScenario() {
  console.log('\n==========================================================================');
  console.log('  REVENUE RECOVERY ENGINE — LOCAL WEBHOOK TEST SCRIPT');
  console.log('==========================================================================');
  console.log(`  Scenario:       ${scenario.toUpperCase()}`);
  console.log(`  Base URL:       ${baseUrl}`);

  const { merchantId, webhookSecret } = await resolveMerchantAndSecret();
  const customTarget = getOption('targetUrl', 'TARGET_URL');
  const targetEndpoint = customTarget || `${baseUrl.replace(/\/$/, '')}/api/v1/webhooks/razorpay/${merchantId}`;

  console.log(`  Target URL:     ${targetEndpoint}`);
  console.log(`  Merchant ID:    ${merchantId}`);
  console.log(`  Webhook Secret: ${webhookSecret}`);
  console.log(`  Event ID:       ${eventId}`);
  console.log(`  Event Type:     ${eventType}`);
  console.log('==========================================================================\n');

  let rawBody: string;
  let signatureSecret: string;
  const effectiveEventId = eventId;

  switch (scenario) {
    case 'invalid-signature': {
      rawBody = buildPayload(effectiveEventId, eventType);
      signatureSecret = 'invalid_wrong_secret_key_999';
      console.log('--> Using INVALID secret key to trigger signature mismatch...\n');
      break;
    }

    case 'malformed-json': {
      rawBody = '{"entity":"event", "broken_json_syntax": ';
      signatureSecret = webhookSecret;
      console.log('--> Sending MALFORMED JSON body payload...\n');
      break;
    }

    case 'duplicate': {
      rawBody = buildPayload(effectiveEventId, eventType);
      signatureSecret = webhookSecret;
      console.log('--> Executing DUPLICATE scenario: sending request #1 (should persist)...\n');

      const signature1 = crypto
        .createHmac('sha256', signatureSecret)
        .update(rawBody)
        .digest('hex');

      console.log(`[REQUEST #1] POST ${targetEndpoint}`);
      console.log(`  X-Razorpay-Signature: ${signature1}`);
      console.log(`  X-Razorpay-Event-Id:   ${effectiveEventId}`);

      try {
        const res1 = await sendHttpRequest(
          targetEndpoint,
          'POST',
          rawBody,
          {
            'X-Razorpay-Signature': signature1,
            'X-Razorpay-Event-Id': effectiveEventId,
          },
        );
        console.log(`\n[RESPONSE #1] HTTP ${res1.statusCode}`);
        console.log(`  Body: ${res1.body}\n`);
      } catch (err: any) {
        console.error(`\n[ERROR #1] Failed to connect: ${err.message}\n`);
        process.exit(1);
      }

      console.log('--> Resending exact DUPLICATE request #2 (should acknowledge duplicate)...\n');
      break;
    }

    case 'valid':
    default: {
      rawBody = buildPayload(effectiveEventId, eventType);
      signatureSecret = webhookSecret;
      console.log('--> Sending VALID authentic Razorpay webhook request...\n');
      break;
    }
  }

  // Compute HMAC SHA-256 signature over raw body string
  const signature = crypto
    .createHmac('sha256', signatureSecret)
    .update(rawBody)
    .digest('hex');

  console.log(`[REQUEST] POST ${targetEndpoint}`);
  console.log(`  Header X-Razorpay-Signature: ${signature}`);
  console.log(`  Header X-Razorpay-Event-Id:   ${effectiveEventId}`);
  console.log(`  Raw Body Length:             ${Buffer.byteLength(rawBody, 'utf8')} bytes`);
  console.log(`  Raw Body Payload Preview:\n${rawBody.substring(0, 300)}...\n`);

  try {
    const res = await sendHttpRequest(
      targetEndpoint,
      'POST',
      rawBody,
      {
        'X-Razorpay-Signature': signature,
        'X-Razorpay-Event-Id': effectiveEventId,
      },
    );

    console.log('==========================================================================');
    console.log(`  HTTP RESPONSE STATUS: ${res.statusCode}`);
    console.log('==========================================================================');
    try {
      const parsedJson = JSON.parse(res.body);
      console.log('  Response Payload:\n', JSON.stringify(parsedJson, null, 2));
    } catch {
      console.log('  Response Payload:\n', res.body);
    }
    console.log('==========================================================================\n');

    if (scenario === 'valid' || scenario === 'duplicate') {
      if (res.statusCode === 200) {
        console.log('✓ SUCCESS: Webhook accepted cleanly.\n');
      } else {
        console.log(`x FAILED: Expected HTTP 200 OK, got HTTP ${res.statusCode}\n`);
        process.exit(1);
      }
    } else if (scenario === 'invalid-signature' || scenario === 'malformed-json') {
      if (res.statusCode === 400) {
        console.log('✓ SUCCESS: Webhook rejected properly with HTTP 400 Bad Request.\n');
      } else {
        console.log(`x FAILED: Expected HTTP 400 Bad Request, got HTTP ${res.statusCode}\n`);
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error(`\n[CONNECTION ERROR] ${err.message}`);
    console.error('Make sure your NestJS backend server is running on localhost!\n');
    process.exit(1);
  }
}

runTestScenario();
