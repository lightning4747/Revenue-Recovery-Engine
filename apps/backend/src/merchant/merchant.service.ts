import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { CryptoService } from '../auth/crypto/crypto.service';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.provider';
import * as schema from '../database/schema';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

@Injectable()
export class MerchantService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly cryptoService: CryptoService,
  ) {}

  async updateCredentials(
    merchantId: string,
    dto: UpdateCredentialsDto,
  ): Promise<{ keyId: string; updatedAt: string }> {
    const encryptedKeySecret = this.cryptoService.encrypt(dto.keySecret);
    const encryptedWebhookSecret = this.cryptoService.encrypt(dto.webhookSecret);
    const now = new Date().toISOString();

    const existing = await this.db
      .select()
      .from(schema.merchantCredentials)
      .where(eq(schema.merchantCredentials.merchantId, merchantId));

    if (existing.length > 0) {
      await this.db
        .update(schema.merchantCredentials)
        .set({
          keyId: dto.keyId,
          encryptedKeySecret,
          encryptedWebhookSecret,
          updatedAt: now,
        })
        .where(eq(schema.merchantCredentials.merchantId, merchantId));
    } else {
      await this.db.insert(schema.merchantCredentials).values({
        merchantId,
        keyId: dto.keyId,
        encryptedKeySecret,
        encryptedWebhookSecret,
        updatedAt: now,
      });
    }

    return {
      keyId: dto.keyId,
      updatedAt: now,
    };
  }

  async getCredentialMetadata(
    merchantId: string,
  ): Promise<{ keyId: string; updatedAt: string } | null> {
    const records = await this.db
      .select({
        keyId: schema.merchantCredentials.keyId,
        updatedAt: schema.merchantCredentials.updatedAt,
      })
      .from(schema.merchantCredentials)
      .where(eq(schema.merchantCredentials.merchantId, merchantId));

    return records.length > 0 ? records[0] : null;
  }

  async getDecryptedCredentials(
    merchantId: string,
  ): Promise<{ keyId: string; keySecret: string; webhookSecret: string } | null> {
    const records = await this.db
      .select()
      .from(schema.merchantCredentials)
      .where(eq(schema.merchantCredentials.merchantId, merchantId));

    if (records.length === 0) {
      return null;
    }

    const creds = records[0];
    const keySecret = this.cryptoService.decrypt(creds.encryptedKeySecret);
    const webhookSecret = this.cryptoService.decrypt(creds.encryptedWebhookSecret);

    return {
      keyId: creds.keyId,
      keySecret,
      webhookSecret,
    };
  }

  async getPolicy(merchantId: string) {
    const records = await this.db
      .select()
      .from(schema.merchantPolicies)
      .where(eq(schema.merchantPolicies.merchantId, merchantId));

    if (records.length > 0) {
      return records[0];
    }

    return {
      merchantId,
      minRecoveryAmount: 1000,
      maxRetryCount: 3,
      autoExecutionEnabled: true,
    };
  }

  async updatePolicy(
    merchantId: string,
    dto: { minRecoveryAmount?: number; maxRetryCount?: number; autoExecutionEnabled?: boolean },
  ) {
    const now = new Date().toISOString();
    const existing = await this.db
      .select()
      .from(schema.merchantPolicies)
      .where(eq(schema.merchantPolicies.merchantId, merchantId));

    if (existing.length > 0) {
      const updated = await this.db
        .update(schema.merchantPolicies)
        .set({
          ...(dto.minRecoveryAmount !== undefined
            ? { minRecoveryAmount: dto.minRecoveryAmount }
            : {}),
          ...(dto.maxRetryCount !== undefined
            ? { maxRetryCount: dto.maxRetryCount }
            : {}),
          ...(dto.autoExecutionEnabled !== undefined
            ? { autoExecutionEnabled: dto.autoExecutionEnabled }
            : {}),
          updatedAt: now,
        })
        .where(eq(schema.merchantPolicies.merchantId, merchantId))
        .returning();
      return updated[0];
    } else {
      const policyId = `pol_${crypto.randomBytes(8).toString('hex')}`;
      const inserted = await this.db
        .insert(schema.merchantPolicies)
        .values({
          id: policyId,
          merchantId,
          minRecoveryAmount: dto.minRecoveryAmount ?? 1000,
          maxRetryCount: dto.maxRetryCount ?? 3,
          autoExecutionEnabled: dto.autoExecutionEnabled ?? true,
          updatedAt: now,
        })
        .returning();
      return inserted[0];
    }
  }
}
