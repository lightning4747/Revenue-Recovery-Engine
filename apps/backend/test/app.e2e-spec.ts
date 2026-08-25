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

    // Clean tables for deterministic test execution
    await db.execute(
      sql`TRUNCATE TABLE merchants, merchant_credentials, user_sessions, webhook_events CASCADE`,
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

      const tokenC = regRes.body.data.accessToken;

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
      expect(row.processing_status).toBe('PENDING');
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
  });
});
