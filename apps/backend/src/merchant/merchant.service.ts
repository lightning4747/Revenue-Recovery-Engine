import { Inject, Injectable } from '@nestjs/common';
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
}
