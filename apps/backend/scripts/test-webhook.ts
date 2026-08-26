import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

// Helper to extract CLI flags (--key=value) or fallback to environment variables
function getOption(flagName: string, envName: string, fallback: string): string {
  const prefix = `--${flagName}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) {
    return found.substring(prefix.length);
  }
  return process.env[envName] || fallback;
}

const port = process.env.PORT || '3000';
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const merchantId = getOption('merchantId', 'MERCHANT_ID', 'm_test_merchant_123');
const webhookSecret = getOption('webhookSecret', 'WEBHOOK_SECRET', 'dummy_webhook_secret');
const scenario = getOption('scenario', 'SCENARIO', 'valid');
const eventId = getOption('eventId', 'EVENT_ID', `evt_local_${Date.now()}`);
const eventType = getOption('eventType', 'EVENT_TYPE', 'payment.failed');

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

// Sends an HTTP POST request to the local webhook controller
function sendWebhookRequest(
  targetUrl: string,
  rawBody: string,
  signature: string,
  evIdHeader: string,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(rawBody, 'utf8'),
        'X-Razorpay-Signature': signature,
        'X-Razorpay-Event-Id': evIdHeader,
      },
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

    req.write(rawBody, 'utf8');
    req.end();
  });
}

// Main execution function
async function runTestScenario() {
  const targetEndpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/webhooks/razorpay/${merchantId}`;

  console.log('\n==========================================================================');
  console.log('  REVENUE RECOVERY ENGINE — LOCAL WEBHOOK TEST SCRIPT');
  console.log('==========================================================================');
  console.log(`  Scenario:       ${scenario.toUpperCase()}`);
  console.log(`  Target URL:     ${targetEndpoint}`);
  console.log(`  Merchant ID:    ${merchantId}`);
  console.log(`  Webhook Secret: ${webhookSecret}`);
  console.log(`  Event ID:       ${eventId}`);
  console.log(`  Event Type:     ${eventType}`);
  console.log('==========================================================================\n');

  let rawBody: string;
  let signatureSecret: string;
  let effectiveEventId = eventId;

  switch (scenario.toLowerCase()) {
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
        const res1 = await sendWebhookRequest(targetEndpoint, rawBody, signature1, effectiveEventId);
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
    const res = await sendWebhookRequest(targetEndpoint, rawBody, signature, effectiveEventId);

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
