import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';

@Injectable()
export class FailureDetectionService {
  private readonly logger = new Logger(FailureDetectionService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async processFailedPayment(
    merchantId: string,
    webhookEventId: string,
    payload: Record<string, any>,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect | null> {
    if (!merchantId) {
      this.logger.warn('Cannot process failed payment: missing merchantId');
      return null;
    }

    const paymentEntity = payload?.payload?.payment?.entity || {};
    const paymentId = paymentEntity.id;
    const orderId = paymentEntity.order_id;
    const amount = Number(paymentEntity.amount || 0);
    const currency = paymentEntity.currency || 'INR';

    if (!paymentId) {
      this.logger.warn(
        `Failed payment event missing payment entity ID for merchant ${merchantId}`,
      );
      return null;
    }

    // 1. Layer 1 Deduplication Check: verify if opportunity already exists for this payment ID
    const existing = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(
        and(
          eq(schema.recoveryOpportunities.merchantId, merchantId),
          eq(schema.recoveryOpportunities.originalTransactionId, paymentId),
        ),
      );

    if (existing.length > 0) {
      this.logger.log(
        `OPPORTUNITY_DUPLICATE_EXISTS: RecoveryOpportunity for payment ${paymentId} already recorded (ID: ${existing[0].id})`,
      );
      return existing[0];
    }

    // 2. Instantiate new RecoveryOpportunity with status = 'OBSERVED'
    const opportunityId = `opp_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    try {
      const inserted = await this.db
        .insert(schema.recoveryOpportunities)
        .values({
          id: opportunityId,
          merchantId,
          sourceType: 'FAILED_PAYMENT',
          sourceId: paymentId,
          originalTransactionId: paymentId,
          originalOrderId: orderId,
          amount,
          recoveredAmount: 0,
          remainingAmount: amount,
          currency,
          status: 'OBSERVED',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      this.logger.log(
        `RECOVERY_OPPORTUNITY_CREATED: Created FAILED_PAYMENT opportunity ${opportunityId} for transaction ${paymentId} (Amount: ${amount} ${currency})`,
      );

      return inserted[0] || null;
    } catch (error: any) {
      this.logger.error(
        `Failed to create RecoveryOpportunity for payment ${paymentId}: ${error?.message}`,
      );
      throw error;
    }
  }
}
