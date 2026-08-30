import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DRIZZLE_DB, DrizzleDb } from '../../src/database/database.provider';
import * as schema from '../../src/database/schema';
import { sql } from 'drizzle-orm';
import * as nodeCrypto from 'crypto';

jest.setTimeout(30000);

describe('Phase 12 E2E Hardening - Vertical Slice (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDb;
  let merchantId: string;
  let token: string;
  const webhookSecret = 'whsec_vertical_slice_test_999';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = app.get<DrizzleDb>(DRIZZLE_DB);

    // 1. Register Merchant
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `vertical_slice_${Date.now()}@example.com`,
        password: 'Password123!',
        businessName: 'Vertical Slice Corp',
      })
      .expect(201);

    token = regRes.body.data?.accessToken || regRes.body.accessToken;
    const payloadBase64 = token.split('.')[1];
    const decodedPayload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString('utf8'),
    );
    merchantId = decodedPayload.sub;

    // 2. Set Merchant Credentials
    await request(app.getHttpServer())
      .put('/api/v1/merchant/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        keyId: 'rzp_test_vertical_slice',
        keySecret: 'secret_vertical_slice',
        webhookSecret,
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should execute full vertical recovery slice from payment failure to verified revenue', async () => {
    const origTxId = `pay_vert_slice_${Date.now()}`;
    const payloadObj = {
      entity: 'event',
      account_id: 'acc_vert_slice',
      event: 'payment.failed',
      event_id: `evt_vert_${Date.now()}`,
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: origTxId,
            amount: 250000, // ₹2,500.00
            status: 'failed',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment failed due to insufficient funds',
          },
        },
      },
    };

    const payloadString = JSON.stringify(payloadObj);
    const signature = nodeCrypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    // 1. Send payment.failed webhook
    const webRes = await request(app.getHttpServer())
      .post(`/api/v1/webhooks/razorpay/${merchantId}`)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', payloadObj.event_id)
      .send(payloadString)
      .expect(200);

    expect(webRes.body.status).toBe('persisted');

    // 2. Wait for worker processing & action dispatch (ACTION_DISPATCHED status)
    let oppId = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 250));
      const dbResult = await db.execute(sql`
        SELECT id, status FROM recovery_opportunities
        WHERE merchant_id = ${merchantId} AND original_transaction_id = ${origTxId}
      `);
      if (dbResult.rows.length > 0) {
        const row: any = dbResult.rows[0];
        if (row.status === 'ACTION_DISPATCHED') {
          oppId = row.id;
          break;
        }
      }
    }

    expect(oppId).not.toBe('');

    // 3. Send payment_link.paid webhook (₹2,500.00 recovered)
    const paidPayloadObj = {
      entity: 'event',
      account_id: 'acc_vert_slice',
      event: 'payment_link.paid',
      event_id: `evt_vert_paid_${Date.now()}`,
      contains: ['payment_link', 'payment'],
      payload: {
        payment_link: {
          entity: {
            id: `plink_vert_${Date.now()}`,
            reference_id: `${oppId.substring(0, 24)}_att_1`,
            amount_paid: 250000,
            notes: { opportunity_id: oppId },
          },
        },
        payment: {
          entity: {
            id: `pay_vert_paid_${Date.now()}`,
            amount: 250000,
            status: 'captured',
          },
        },
      },
    };

    const paidPayloadString = JSON.stringify(paidPayloadObj);
    const paidSig = nodeCrypto
      .createHmac('sha256', webhookSecret)
      .update(paidPayloadString)
      .digest('hex');

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/razorpay/${merchantId}`)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', paidSig)
      .set('x-razorpay-event-id', paidPayloadObj.event_id)
      .send(paidPayloadString)
      .expect(200);

    // 4. Verify opportunity status transitioned to RECOVERED
    let recovered = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((res) => setTimeout(res, 200));
      const oppResult = await db.execute(sql`
        SELECT status, recovered_amount FROM recovery_opportunities WHERE id = ${oppId}
      `);
      if (oppResult.rows.length > 0) {
        const row: any = oppResult.rows[0];
        if (row.status === 'RECOVERED') {
          recovered = true;
          expect(Number(row.recovered_amount)).toBe(250000);
          break;
        }
      }
    }

    expect(recovered).toBe(true);
  });
});
