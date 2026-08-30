import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DRIZZLE_DB, DrizzleDb } from './database.provider';
import * as schema from './schema';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async onModuleInit() {
    try {
      const merchants = await this.db.select().from(schema.merchants);
      if (merchants.length === 0) {
        const defaultMerchantId = 'm_default_merchant';
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
    } catch {
      // Ignore seeding errors on cold init prior to migrations
    }
  }
}
