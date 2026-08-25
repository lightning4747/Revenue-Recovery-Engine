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
});
