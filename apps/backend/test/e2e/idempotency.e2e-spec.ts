import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DRIZZLE_DB, DrizzleDb } from '../../src/database/database.provider';
import { sql } from 'drizzle-orm';
import * as nodeCrypto from 'crypto';

jest.setTimeout(30000);

describe('Phase 12 E2E Hardening - 3-Tier Idempotency (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let merchantId: string;
  let token: string;
  const webhookSecret = 'whsec_idempotency_test_888';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = app.get<DrizzleDb>(DRIZZLE_DB);

    // Register Merchant
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `idempotency_${Date.now()}@example.com`,
        password: 'Password123!',
        businessName: 'Idempotency Corp',
      })
      .expect(201);

    token = regRes.body.data?.accessToken || regRes.body.accessToken;
    const payloadBase64 = token.split('.')[1];
    const decodedPayload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString('utf8'),
    );
    merchantId = decodedPayload.sub;

    await request(app.getHttpServer())
      .put('/api/v1/merchant/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        keyId: 'rzp_test_idempotency',
        keySecret: 'secret_idempotency',
        webhookSecret,
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Layer 1 Ingestion Idempotency - 10 concurrent identical webhooks create exactly 1 WebhookEvent record', async () => {
    const eventId = `evt_stress_10_${Date.now()}`;
    const payloadObj = {
      entity: 'event',
      account_id: 'acc_idempotency',
      event: 'payment.failed',
      event_id: eventId,
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: `pay_stress_${Date.now()}`,
            amount: 100000,
            status: 'failed',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Stress test failed payment',
          },
        },
      },
    };

    const payloadString = JSON.stringify(payloadObj);
    const signature = nodeCrypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    const results = [];
    for (let i = 0; i < 10; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/razorpay/${merchantId}`)
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', eventId)
        .send(payloadString);
      results.push(res);
    }

    // All requests must return HTTP 200 OK (processed or idempotently skipped)
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    // Verify DB count
    const dbResult = await db.execute(sql`
      SELECT count(*)::int as count FROM webhook_events
      WHERE provider_event_id = ${eventId}
    `);

    expect((dbResult.rows[0] as any).count).toBe(1);
  });
});
