import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database.module';
import { DRIZZLE_DB, DrizzleDb } from './database.provider';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { envValidationSchema } from '../common/config/env.validation';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import * as path from 'path';

describe('DatabaseModule (Integration)', () => {
  let db: DrizzleDb;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        DatabaseModule,
      ],
    }).compile();

    db = moduleRef.get<DrizzleDb>(DRIZZLE_DB);

    const migrationsFolder = path.join(__dirname, '../../drizzle');
    await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('should connect to PostgreSQL and confirm tables exist', async () => {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = result.rows.map((row: any) => row.table_name);
    expect(tableNames).toContain('merchants');
    expect(tableNames).toContain('webhook_events');
    expect(tableNames).toContain('recovery_opportunities');
    expect(tableNames).toContain('recovery_payments');
  });

  it('should verify monetary fields are BIGINT in PostgreSQL', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'recovery_opportunities' 
        AND column_name IN ('amount', 'recovered_amount', 'remaining_amount')
    `);
    expect(result.rows.length).toBe(3);
    result.rows.forEach((row: any) => {
      expect(row.data_type).toBe('bigint');
    });
  });

  it('should enforce composite unique constraint on webhook_events', async () => {
    const providerEventId = `evt_test_${Date.now()}`;
    await db.insert(schema.webhookEvents).values({
      provider: 'razorpay',
      providerEventId,
      eventType: 'payment.failed',
      payload: { test: true },
    });

    await expect(
      db.insert(schema.webhookEvents).values({
        provider: 'razorpay',
        providerEventId,
        eventType: 'payment.failed',
        payload: { test: true },
      }),
    ).rejects.toThrow();
  });

  it('should enforce tenant foreign key relationships', async () => {
    const merchantId = `m_test_${Date.now()}`;
    await db.insert(schema.merchants).values({
      id: merchantId,
      businessName: 'Test Merchant',
      email: `test_${Date.now()}@example.com`,
    });

    const opportunityId = `opp_${Date.now()}`;
    await db.insert(schema.recoveryOpportunities).values({
      id: opportunityId,
      merchantId,
      sourceType: 'FAILED_PAYMENT',
      sourceId: 'pay_123',
      amount: 10000,
      remainingAmount: 10000,
    });

    const paymentId = `pay_rcv_${Date.now()}`;
    await db.insert(schema.recoveryPayments).values({
      merchantId,
      opportunityId,
      razorpayPaymentId: paymentId,
      amount: 10000,
    });

    await expect(
      db.insert(schema.recoveryPayments).values({
        merchantId,
        opportunityId,
        razorpayPaymentId: paymentId,
        amount: 10000,
      }),
    ).rejects.toThrow();
  });
});
