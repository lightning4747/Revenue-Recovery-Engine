import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { CryptoService } from '../../auth/crypto/crypto.service';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { WebhookVerificationService } from './verification/webhook-verification.service';

export interface WebhookHandlingResult {
  status: 'persisted' | 'acknowledged';
  duplicate: boolean;
  id?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly cryptoService: CryptoService,
    private readonly verificationService: WebhookVerificationService,
  ) {}

  async handleWebhook(
    merchantId: string,
    rawBody: Buffer,
    signature: string,
    eventIdHeader?: string,
  ): Promise<WebhookHandlingResult> {
    if (!merchantId) {
      throw new BadRequestException('Merchant ID is required');
    }
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Raw request body is required');
    }
    if (!signature) {
      throw new BadRequestException('Webhook signature is required');
    }

    // 1. Fetch merchant credentials & encrypted webhook secret
    const credentials = await this.db
      .select({
        encryptedWebhookSecret: schema.merchantCredentials.encryptedWebhookSecret,
      })
      .from(schema.merchantCredentials)
      .where(eq(schema.merchantCredentials.merchantId, merchantId));

    if (credentials.length === 0 || !credentials[0].encryptedWebhookSecret) {
      this.logger.warn(
        `Webhook verification failed: No credentials found for merchant ${merchantId}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Decrypt secret & verify HMAC SHA-256 signature
    let decryptedSecret: string;
    try {
      decryptedSecret = this.cryptoService.decrypt(
        credentials[0].encryptedWebhookSecret,
      );
    } catch (error) {
      this.logger.error(
        `Failed to decrypt webhook secret for merchant ${merchantId}: ${(error as Error).message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    const isValidSignature = this.verificationService.verifySignature(
      rawBody,
      signature,
      decryptedSecret,
    );

    if (!isValidSignature) {
      this.logger.warn(
        `WEBHOOK_SIGNATURE_FAILED: Invalid HMAC signature for merchant ${merchantId}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // 3. Safe JSON Parsing
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      this.logger.warn(
        `Webhook payload JSON parsing failed for merchant ${merchantId}`,
      );
      throw new BadRequestException('Malformed JSON payload');
    }

    if (typeof payload !== 'object' || payload === null) {
      throw new BadRequestException('Malformed JSON payload');
    }

    // 4. Extract Event Identity
    const providerEventId =
      (typeof eventIdHeader === 'string' && eventIdHeader.trim() !== ''
        ? eventIdHeader
        : undefined) ||
      (typeof payload.event_id === 'string' ? payload.event_id : undefined) ||
      (typeof payload.id === 'string' ? payload.id : undefined);

    if (!providerEventId) {
      this.logger.warn(
        `Webhook payload missing providerEventId for merchant ${merchantId}`,
      );
      throw new BadRequestException('Missing event identifier');
    }

    const eventType = typeof payload.event === 'string' ? payload.event : undefined;
    if (!eventType) {
      this.logger.warn(
        `Webhook payload missing eventType for merchant ${merchantId}`,
      );
      throw new BadRequestException('Missing event type');
    }

    // 5. Deduplication Check (Layer 1: Query existing event)
    const existingEvents = await this.db
      .select({ id: schema.webhookEvents.id })
      .from(schema.webhookEvents)
      .where(
        and(
          eq(schema.webhookEvents.provider, 'razorpay'),
          eq(schema.webhookEvents.providerEventId, providerEventId),
        ),
      );

    if (existingEvents.length > 0) {
      this.logger.log(
        `WEBHOOK_DUPLICATE_RECEIVED: Provider event ID ${providerEventId} already recorded`,
      );
      return {
        status: 'acknowledged',
        duplicate: true,
        id: existingEvents[0].id,
      };
    }

    // 6. Persistence into Event Store with DB Unique Constraint Catch (Layer 2: Atomic DB guard)
    try {
      const inserted = await this.db
        .insert(schema.webhookEvents)
        .values({
          provider: 'razorpay',
          providerEventId,
          eventType,
          payload,
          processingStatus: 'PENDING',
        })
        .returning({ id: schema.webhookEvents.id });

      this.logger.log(
        `WEBHOOK_PERSISTED: Successfully saved event ${providerEventId} (${eventType}) with ID ${inserted[0]?.id}`,
      );

      return {
        status: 'persisted',
        duplicate: false,
        id: inserted[0]?.id,
      };
    } catch (error: any) {
      // Postgres unique constraint violation code '23505'
      if (error?.code === '23505' || error?.message?.includes('unique constraint')) {
        this.logger.log(
          `WEBHOOK_DUPLICATE_CONCURRENT: Caught unique constraint for event ${providerEventId}`,
        );
        return {
          status: 'acknowledged',
          duplicate: true,
        };
      }
      this.logger.error(
        `Database persistence failed for webhook event ${providerEventId}: ${error?.message}`,
      );
      throw error;
    }
  }
}
