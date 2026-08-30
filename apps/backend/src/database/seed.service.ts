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

      // Ensure merchantCredentials exist for default merchant
      if (this.cryptoService) {
        const creds = await this.db
          .select()
          .from(schema.merchantCredentials)
          .where(eq(schema.merchantCredentials.merchantId, defaultMerchantId));

        if (creds.length === 0) {
          const webhookSecret = this.configService?.get('WEBHOOK_SECRET') || 'dummy_webhook_secret';
          const keySecret = this.configService?.get('RAZORPAY_KEY_SECRET') || 'dummy_key_secret';
          const keyId = this.configService?.get('RAZORPAY_KEY_ID') || 'rzp_test_default_key';

          await this.db.insert(schema.merchantCredentials).values({
            merchantId: defaultMerchantId,
            keyId,
            encryptedKeySecret: this.cryptoService.encrypt(keySecret),
            encryptedWebhookSecret: this.cryptoService.encrypt(webhookSecret),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Ignore seeding errors on cold init prior to migrations
    }
  }
}
