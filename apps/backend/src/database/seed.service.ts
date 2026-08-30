import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { CryptoService } from '../auth/crypto/crypto.service';
import { DRIZZLE_DB, DrizzleDb } from './database.provider';
import * as schema from './schema';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Optional() private readonly cryptoService?: CryptoService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      const defaultMerchantId = 'm_default_merchant';
      const merchants = await this.db.select().from(schema.merchants);

      if (merchants.length === 0) {
        const passwordHash = await bcrypt.hash('password123', 10);
        await this.db.insert(schema.merchants).values({
          id: defaultMerchantId,
          email: 'merchant@example.com',
          businessName: 'Default Merchant Corp',
          passwordHash,
        });

        // Initialize default merchant policy
        await this.db.insert(schema.merchantPolicies).values({
          id: `pol_${defaultMerchantId}`,
          merchantId: defaultMerchantId,
          minRecoveryAmount: 10000,
          maxRetryCount: 3,
          autoExecutionEnabled: true,
        });
      }

      // Ensure merchantCredentials exist and are up to date for default merchant
      if (this.cryptoService) {
        const webhookSecret = this.configService?.get('WEBHOOK_SECRET') || 'bow_webhook_secret_123';
        const keySecret = this.configService?.get('RAZORPAY_KEY_SECRET') || 'YN2yrJLEyHY51aa7dOZV8eVx';
        const keyId = this.configService?.get('RAZORPAY_KEY_ID') || 'rzp_test_TVsCTwvJZE0JqB';

        const encryptedKeySecret = this.cryptoService.encrypt(keySecret);
        const encryptedWebhookSecret = this.cryptoService.encrypt(webhookSecret);
        const now = new Date().toISOString();

        const creds = await this.db
          .select()
          .from(schema.merchantCredentials)
          .where(eq(schema.merchantCredentials.merchantId, defaultMerchantId));

        if (creds.length === 0) {
          await this.db.insert(schema.merchantCredentials).values({
            merchantId: defaultMerchantId,
            keyId,
            encryptedKeySecret,
            encryptedWebhookSecret,
            updatedAt: now,
          });
        } else {
          await this.db
            .update(schema.merchantCredentials)
            .set({
              keyId,
              encryptedKeySecret,
              encryptedWebhookSecret,
              updatedAt: now,
            })
            .where(eq(schema.merchantCredentials.merchantId, defaultMerchantId));
        }
      }
    } catch {
      // Ignore seeding errors on cold init prior to migrations
    }
  }
}
