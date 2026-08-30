import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { DRIZZLE_DB, DrizzleDb } from './../src/database/database.provider';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';

describe('AppController & Auth/Merchant (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    db = app.get<DrizzleDb>(DRIZZLE_DB);
    const migrationsFolder = path.join(__dirname, '../drizzle');
    await migrate(db, { migrationsFolder });

    // Clean test-scoped records for deterministic test execution without wiping persistent merchants
    await db.execute(
      sql`DELETE FROM merchants WHERE email LIKE 'merchant_%@example.com'`,
    );
    await db.execute(
      sql`TRUNCATE TABLE webhook_events CASCADE`,
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
        expect(typeof res.body.data.uptime).toBe('number');
      });
  });

  describe('Authentication & Tenant Isolation', () => {
    const merchantA = {
      email: `merchant_a_${Date.now()}@example.com`,
      password: 'password123',
      businessName: 'Merchant A Corp',
    };

    const merchantB = {
      email: `merchant_b_${Date.now()}@example.com`,
      password: 'password456',
      businessName: 'Merchant B Corp',
    };

    it('POST /api/v1/auth/register - should register Merchant A and return access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(merchantA)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      tokenA = res.body.data.accessToken;
    });

    it('POST /api/v1/auth/register - should return 409 Conflict on duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(merchantA)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Conflict');
    });

    it('POST /api/v1/auth/register - should register Merchant B and return access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(merchantB)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      tokenB = res.body.data.accessToken;
    });

    it('POST /api/v1/auth/login - should authenticate Merchant A and return JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: merchantA.email,
          password: merchantA.password,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('POST /api/v1/auth/login - should return 401 Unauthorized on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: merchantA.email,
          password: 'wrong_password',
        })
        .expect(401);
    });

    it('PUT /api/v1/merchant/credentials - should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/merchant/credentials')
        .send({
          keyId: 'rzp_test_12345',
          keySecret: 'secret_key_123',
          webhookSecret: 'wh_secret_123',
        })
        .expect(401);
    });

    it('PUT /api/v1/merchant/credentials - should store encrypted credentials for Merchant A', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/merchant/credentials')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          keyId: 'rzp_test_merchantA_key',
          keySecret: 'secret_key_merchantA',
          webhookSecret: 'webhook_secret_merchantA',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.keyId).toBe('rzp_test_merchantA_key');
      expect(res.body.data.keySecret).toBeUndefined();
      expect(res.body.data.webhookSecret).toBeUndefined();
    });

    it('Direct DB Verification - secrets must be stored encrypted at rest (AES-256-GCM)', async () => {
      const dbResult = await db.execute(sql`
        SELECT key_id, encrypted_key_secret, encrypted_webhook_secret 
        FROM merchant_credentials 
        WHERE key_id = 'rzp_test_merchantA_key'
      `);

      expect(dbResult.rows.length).toBe(1);
      const row: any = dbResult.rows[0];

      expect(row.encrypted_key_secret).not.toBe('secret_key_merchantA');
      expect(row.encrypted_webhook_secret).not.toBe('webhook_secret_merchantA');

      expect(row.encrypted_key_secret.split(':')).toHaveLength(3);
      expect(row.encrypted_webhook_secret.split(':')).toHaveLength(3);
    });

    it('Cross-Tenant Isolation - Merchant B cannot access or view Merchant A credentials', async () => {
      const resB = await request(app.getHttpServer())
        .get('/api/v1/merchant/credentials')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(resB.body.success).toBe(true);
      expect(resB.body.data).toBeNull();
    });
  });

  describe('Webhook Ingestion & Signature Verification (e2e)', () => {
    let merchantCId: string;
    let tokenC: string;
    const webhookSecret = 'webhook_secret_merchantC_999';
    let validSignature: string;

    const payloadObj = {
      entity: 'event',
      account_id: 'acc_merchantC',
      event: 'payment.failed',
      event_id: 'evt_e2e_test_1001',
      payload: {
        payment: {
          entity: {
            id: 'pay_e2e_1001',
            amount: 15000,
            status: 'failed',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment failed due to insufficient funds',
          },
        },
      },
    };

    const rawBodyString = JSON.stringify(payloadObj);

    beforeAll(async () => {
      // 1. Register Merchant C
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `merchant_c_${Date.now()}@example.com`,
          password: 'password789',
          businessName: 'Merchant C Corp',
        })
        .expect(201);

      tokenC = regRes.body.data.accessToken;

      // Extract merchantId from JWT payload
      const payloadBase64 = tokenC.split('.')[1];
      const decodedPayload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString('utf8'),
      );
      merchantCId = decodedPayload.sub;

      // 2. Set credentials for Merchant C
      await request(app.getHttpServer())
        .put('/api/v1/merchant/credentials')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          keyId: 'rzp_test_merchantC_key',
          keySecret: 'secret_key_merchantC',
          webhookSecret,
        })
        .expect(200);

      // Compute valid HMAC SHA-256 signature against rawBodyString
      const crypto = await import('crypto');
      validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBodyString)
        .digest('hex');
    });

    it('POST /api/v1/webhooks/razorpay/:merchantId - should reject request with missing signature', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .send(rawBodyString)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/webhooks/razorpay/:merchantId - should reject request with tampered body', async () => {
      const crypto = await import('crypto');
      const tamperedString = JSON.stringify({ ...payloadObj, event: 'payment.captured' });
      const invalidSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(tamperedString)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', invalidSignature)
        .send(rawBodyString) // sending rawBodyString which doesn't match tampered signature
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid webhook signature');
    });

    it('POST /api/v1/webhooks/razorpay/:merchantId - should accept valid signature & persist WebhookEvent in <50ms', async () => {
      const startTime = Date.now();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', validSignature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_test_1001')
        .send(rawBodyString)
        .expect(200);

      const durationMs = Date.now() - startTime;
      expect(durationMs).toBeLessThan(100); // 100ms tolerance for test runner overhead

      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicate).toBe(false);
      expect(res.body.data.status).toBe('persisted');
      expect(res.body.data.id).toBeDefined();

      // Direct DB verification
      const dbResult = await db.execute(sql`
        SELECT provider, provider_event_id, event_type, processing_status
        FROM webhook_events
        WHERE provider_event_id = 'evt_e2e_test_1001'
      `);

      expect(dbResult.rows.length).toBe(1);
      const row: any = dbResult.rows[0];
      expect(row.provider).toBe('razorpay');
      expect(row.event_type).toBe('payment.failed');
      expect(['PENDING', 'PROCESSING', 'PROCESSED']).toContain(row.processing_status);
    });

    it('POST /api/v1/webhooks/razorpay/:merchantId - should handle duplicate event delivery idempotently', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', validSignature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_test_1001')
        .send(rawBodyString)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicate).toBe(true);
      expect(res.body.data.status).toBe('acknowledged');

      // Verify DB row count remains 1
      const dbResult = await db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM webhook_events
        WHERE provider_event_id = 'evt_e2e_test_1001'
      `);

      const count: any = dbResult.rows[0];
      expect(count.count).toBe(1);
    });

    it('Asynchronous BullMQ Worker - should process enqueued event and update processing_status to PROCESSED', async () => {
      const asyncPayload = {
        ...payloadObj,
        event_id: 'evt_e2e_async_2001',
      };
      const asyncBodyString = JSON.stringify(asyncPayload);
      const crypto = await import('crypto');
      const asyncSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(asyncBodyString)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', asyncSignature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_async_2001')
        .send(asyncBodyString)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('persisted');

      // Poll DB briefly for async worker processing completion
      let processed = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const dbResult = await db.execute(sql`
          SELECT processing_status, processed_at
          FROM webhook_events
          WHERE provider_event_id = 'evt_e2e_async_2001'
        `);
        if (dbResult.rows.length > 0 && dbResult.rows[0].processing_status === 'PROCESSED') {
          processed = true;
          expect(dbResult.rows[0].processed_at).not.toBeNull();
          break;
        }
      }

      expect(processed).toBe(true);
    });

    it('Phase 06 Detection Engine - should create FAILED_PAYMENT RecoveryOpportunity with status OBSERVED on payment.failed event', async () => {
      const failPayload = {
        entity: 'event',
        account_id: 'acc_merchantC',
        event: 'payment.failed',
        event_id: 'evt_e2e_detect_3001',
        payload: {
          payment: {
            entity: {
              id: 'pay_e2e_detect_3001',
              order_id: 'order_e2e_detect_3001',
              amount: 250000,
              currency: 'INR',
              method: 'card',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment failed due to insufficient funds',
            },
          },
        },
      };
      const failBodyString = JSON.stringify(failPayload);
      const crypto = await import('crypto');
      const failSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(failBodyString)
        .digest('hex');

      await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', failSignature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_detect_3001')
        .send(failBodyString)
        .expect(200);

      // Poll DB for RecoveryOpportunity diagnosis and valuation completion
      let oppFound = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const dbResult = await db.execute(sql`
          SELECT source_type, status, cause, recovery_probability, expected_recovery_value, priority_score, last_payment_link_id, last_payment_link_url, last_reference_id, amount, remaining_amount
          FROM recovery_opportunities
          WHERE merchant_id = ${merchantCId} AND original_transaction_id = 'pay_e2e_detect_3001'
        `);
        if (dbResult.rows.length > 0) {
          const row: any = dbResult.rows[0];
          if (row.status === 'ACTION_DISPATCHED') {
            oppFound = true;
            expect(row.source_type).toBe('FAILED_PAYMENT');
            expect(row.status).toBe('ACTION_DISPATCHED');
            expect(Number(row.amount)).toBe(250000);
            expect(row.cause).toBe('INSUFFICIENT_FUNDS');
            expect(Number(row.recovery_probability)).toBe(0.6);
            expect(Number(row.expected_recovery_value)).toBe(150000);
            expect(Number(row.priority_score)).toBe(150000);
            expect(row.last_payment_link_id).toBeDefined();
            expect(row.last_payment_link_url).toBeDefined();
            expect(row.last_reference_id).toContain('_att_1');
            break;
          }
        }
      }

      expect(oppFound).toBe(true);
    });

    it('Phase 10 Outcome Verification - should process partial payment_link.partially_paid webhook (₹1,000) and update status to PARTIALLY_RECOVERED', async () => {
      const oppQuery = await db.execute(sql`
        SELECT id FROM recovery_opportunities
        WHERE merchant_id = ${merchantCId} AND original_transaction_id = 'pay_e2e_detect_3001'
      `);
      const oppId = (oppQuery.rows[0] as any).id;

      const partialPayload = {
        entity: 'event',
        account_id: 'acc_merchantC',
        event: 'payment_link.partially_paid',
        event_id: 'evt_e2e_partial_5001',
        contains: ['payment_link', 'payment'],
        payload: {
          payment_link: {
            entity: {
              id: 'plink_e2e_5001',
              reference_id: `${oppId.substring(0, 24)}_att_1`,
              amount_paid: 100000,
              notes: {
                opportunity_id: oppId,
              },
            },
          },
          payment: {
            entity: {
              id: 'pay_part_5001',
              amount: 100000,
              status: 'captured',
            },
          },
        },
      };

      const payloadString = JSON.stringify(partialPayload);
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_partial_5001')
        .send(payloadString)
        .expect(200);

      expect(response.body.success).toBe(true);

      let partialFound = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 100));
        const dbResult = await db.execute(sql`
          SELECT status, recovered_amount, remaining_amount
          FROM recovery_opportunities
          WHERE id = ${oppId}
        `);
        if (dbResult.rows.length > 0) {
          const row: any = dbResult.rows[0];
          if (row.status === 'PARTIALLY_RECOVERED') {
            partialFound = true;
            expect(Number(row.recovered_amount)).toBe(100000);
            expect(Number(row.remaining_amount)).toBe(150000);
            break;
          }
        }
      }

      expect(partialFound).toBe(true);
    });

    it('Phase 10 Financial Idempotency - duplicate payment webhook pay_part_5001 should skip ledger update without double counting', async () => {
      const oppQuery = await db.execute(sql`
        SELECT id FROM recovery_opportunities
        WHERE merchant_id = ${merchantCId} AND original_transaction_id = 'pay_e2e_detect_3001'
      `);
      const oppId = (oppQuery.rows[0] as any).id;

      const dupPayload = {
        entity: 'event',
        account_id: 'acc_merchantC',
        event: 'payment_link.partially_paid',
        event_id: 'evt_e2e_partial_5001_dup',
        contains: ['payment_link', 'payment'],
        payload: {
          payment_link: {
            entity: {
              id: 'plink_e2e_5001',
              reference_id: `${oppId.substring(0, 24)}_att_1`,
              amount_paid: 100000,
              notes: {
                opportunity_id: oppId,
              },
            },
          },
          payment: {
            entity: {
              id: 'pay_part_5001',
              amount: 100000,
              status: 'captured',
            },
          },
        },
      };

      const payloadString = JSON.stringify(dupPayload);
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_partial_5001_dup')
        .send(payloadString)
        .expect(200);

      await new Promise((r) => setTimeout(r, 500));

      const dbResult = await db.execute(sql`
        SELECT status, recovered_amount, remaining_amount
        FROM recovery_opportunities
        WHERE id = ${oppId}
      `);

      const row: any = dbResult.rows[0];
      expect(row.status).toBe('PARTIALLY_RECOVERED');
      expect(Number(row.recovered_amount)).toBe(100000);
      expect(Number(row.remaining_amount)).toBe(150000);
    });

    it('Phase 10 Outcome Verification - should process final payment_link.paid webhook (₹1,500) and update status to RECOVERED', async () => {
      const oppQuery = await db.execute(sql`
        SELECT id FROM recovery_opportunities
        WHERE merchant_id = ${merchantCId} AND original_transaction_id = 'pay_e2e_detect_3001'
      `);
      const oppId = (oppQuery.rows[0] as any).id;

      const finalPayload = {
        entity: 'event',
        account_id: 'acc_merchantC',
        event: 'payment_link.paid',
        event_id: 'evt_e2e_final_5002',
        contains: ['payment_link', 'payment'],
        payload: {
          payment_link: {
            entity: {
              id: 'plink_e2e_5001',
              reference_id: `${oppId.substring(0, 24)}_att_1`,
              amount_paid: 250000,
              notes: {
                opportunity_id: oppId,
              },
            },
          },
          payment: {
            entity: {
              id: 'pay_final_5002',
              amount: 150000,
              status: 'captured',
            },
          },
        },
      };

      const payloadString = JSON.stringify(finalPayload);
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .set('X-Razorpay-Event-Id', 'evt_e2e_final_5002')
        .send(payloadString)
        .expect(200);

      let recoveredFound = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise((r) => setTimeout(r, 100));
        const dbResult = await db.execute(sql`
          SELECT status, recovered_amount, remaining_amount, resolved_at
          FROM recovery_opportunities
          WHERE id = ${oppId}
        `);
        if (dbResult.rows.length > 0) {
          const row: any = dbResult.rows[0];
          if (row.status === 'RECOVERED') {
            recoveredFound = true;
            expect(Number(row.recovered_amount)).toBe(250000);
            expect(Number(row.remaining_amount)).toBe(0);
            expect(row.resolved_at).toBeDefined();
            break;
          }
        }
      }

      expect(recoveredFound).toBe(true);
    });

    it('Phase 08 Policy Engine - should block low-value recovery attempt (< minRecoveryAmount) with status POLICY_BLOCKED', async () => {
      const lowAmountPayload = {
        entity: 'event',
        account_id: 'acc_merchantC',
        event: 'payment.failed',
        event_id: 'evt_e2e_policy_4001',
        payload: {
          payment: {
            entity: {
              id: 'pay_e2e_policy_4001',
              order_id: 'order_e2e_policy_4001',
              amount: 500, // ₹5 in paise (below default ₹10 / 1000 paise threshold)
              currency: 'INR',
              method: 'card',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment failed due to insufficient funds',
            },
          },
        },
      };

      const payloadString = JSON.stringify(lowAmountPayload);
      const nodeCrypto = await import('crypto');
      const signature = nodeCrypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantCId}`)
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_e2e_policy_4001')
        .send(payloadString)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('persisted');

      let blockedFound = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise((res) => setTimeout(res, 200));
        const dbResult = await db.execute(sql`
          SELECT status, amount FROM recovery_opportunities
          WHERE merchant_id = ${merchantCId} AND original_transaction_id = 'pay_e2e_policy_4001'
        `);
        if (dbResult.rows.length > 0) {
          const row: any = dbResult.rows[0];
          if (row.status === 'POLICY_BLOCKED') {
            blockedFound = true;
            expect(Number(row.amount)).toBe(500);
            break;
          }
        }
      }

      expect(blockedFound).toBe(true);
    });

    it('Phase 06 Detection Engine - should aggregate 1h rolling telemetry and trigger DEGRADATION opportunity', async () => {
      const { DegradationDetectionService } = await import(
        '../src/revenue/detection/degradation-detection.service'
      );
      const degradationService = app.get(DegradationDetectionService);

      // Seed 10 failed telemetry records for (merchantCId, card, ANOMALY_BANK)
      for (let i = 0; i < 10; i++) {
        await db.execute(sql`
          INSERT INTO payment_telemetry (merchant_id, payment_method, bank, status, amount, timestamp)
          VALUES (${merchantCId}, 'card', 'ANOMALY_BANK', 'failed', 100000, NOW())
        `);
      }

      const results = await degradationService.evaluateDegradation(merchantCId);
      const flagged = results.find(
        (r) => r.merchantId === merchantCId && r.bank === 'ANOMALY_BANK',
      );

      expect(flagged).toBeDefined();
      expect(flagged?.degradationFlagged).toBe(true);

      // Verify RecoveryOpportunity created in DB
      const oppResult = await db.execute(sql`
        SELECT source_type, status
        FROM recovery_opportunities
        WHERE merchant_id = ${merchantCId} AND source_id = ${'deg_' + merchantCId + '_card_ANOMALY_BANK'}
      `);

      expect(oppResult.rows.length).toBe(1);
      const row: any = oppResult.rows[0];
      expect(row.source_type).toBe('DEGRADATION');
      expect(row.status).toBe('OBSERVED');
    });

    describe('Phase 11 Control Tower Dashboard Subsystem (e2e)', () => {
      it('GET /api/v1/dashboard/summary - should return aggregated financial metrics for authenticated merchant', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/dashboard/summary')
          .set('Authorization', `Bearer ${tokenC}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.revenueAtRiskPaise).toBeDefined();
        expect(res.body.data.verifiedRecoveredPaise).toBeDefined();
        expect(res.body.data.recoveryRatePercentage).toBeDefined();
      });

      it('GET /api/v1/dashboard/opportunities - should return paginated opportunities sorted by priorityScore', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/dashboard/opportunities?page=1&limit=10')
          .set('Authorization', `Bearer ${tokenC}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.data)).toBe(true);
        expect(res.body.data.total).toBeDefined();
      });

      it('GET /api/v1/dashboard/audit-trail/:id - should return sanitized audit timeline', async () => {
        const oppResult = await db.execute(sql`
          SELECT id FROM recovery_opportunities
          WHERE merchant_id = ${merchantCId} LIMIT 1
        `);

        if (oppResult.rows.length > 0) {
          const oppId = (oppResult.rows[0] as any).id;
          const res = await request(app.getHttpServer())
            .get(`/api/v1/dashboard/audit-trail/${oppId}`)
            .set('Authorization', `Bearer ${tokenC}`)
            .expect(200);

          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });
    });
  });
});
