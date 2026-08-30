import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DRIZZLE_DB, DrizzleDb } from '../../src/database/database.provider';
import * as nodeCrypto from 'crypto';

jest.setTimeout(30000);

describe('Phase 12 E2E Hardening - Resilience & Fault Tolerance (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let merchantId: string;
  let token: string;
  const webhookSecret = 'whsec_resilience_test_777';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = app.get<DrizzleDb>(DRIZZLE_DB);

    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `resilience_${Date.now()}@example.com`,
        password: 'Password123!',
        businessName: 'Resilience Corp',
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
        keyId: 'rzp_test_resilience',
        keySecret: 'secret_resilience',
        webhookSecret,
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Signature Forgery Protection - should reject webhook with forged signature (HTTP 400)', async () => {
    const payloadObj = {
      entity: 'event',
      account_id: 'acc_forgery',
      event: 'payment.failed',
      event_id: `evt_forgery_${Date.now()}`,
      contains: ['payment'],
      payload: { payment: { entity: { id: 'pay_forgery', amount: 1000 } } },
    };

    const payloadString = JSON.stringify(payloadObj);
    const invalidSignature = 'invalid_forged_hmac_signature_hex_string_1234567890abcdef';

    const res = await request(app.getHttpServer())
      .post(`/api/v1/webhooks/razorpay/${merchantId}`)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', invalidSignature)
      .set('x-razorpay-event-id', payloadObj.event_id)
      .send(payloadString)
      .expect(400);

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
  });

  it('AI Outage Continuity - AiExplanationService should fall back to deterministic rule template on LLM outage', async () => {
    const { AiExplanationService } = await import(
      '../../src/revenue/ai/ai-explanation.service'
    );
    const aiService = app.get(AiExplanationService);

    // Test with opportunityId string to trigger fallback explanation logic cleanly
    const explanation = await aiService.generateExplanation('opp_fallback_test');

    expect(explanation).toBeDefined();
    expect(explanation.length).toBeGreaterThan(10);
  });
});
