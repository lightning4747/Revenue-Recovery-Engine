import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { DiagnosisService } from '../diagnosis/diagnosis.service';
import { ValuationService } from '../valuation/valuation.service';
import { AiExplanationService } from '../ai/ai-explanation.service';

import { PrioritizationService } from '../../recovery/prioritization/prioritization.service';
import { PolicyEngineService } from '../../recovery/policy/policy-engine.service';

@Injectable()
export class FailureDetectionService {
  private readonly logger = new Logger(FailureDetectionService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Optional() @Inject(DiagnosisService) private readonly diagnosisService?: DiagnosisService,
    @Optional() @Inject(ValuationService) private readonly valuationService?: ValuationService,
    @Optional() @Inject(AiExplanationService) private readonly aiExplanationService?: AiExplanationService,
    @Optional() @Inject(PrioritizationService) private readonly prioritizationService?: PrioritizationService,
    @Optional() @Inject(PolicyEngineService) private readonly policyEngineService?: PolicyEngineService,
  ) {}

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

      const opp = inserted[0];

      // 3. Trigger Phase 07 Diagnosis and Valuation Pipeline
      if (opp && this.diagnosisService) {
        const errorDetails = {
          source: paymentEntity.error_source || payload?.source,
          step: paymentEntity.error_step || payload?.step,
          reason:
            `${paymentEntity.error_code || ''} ${paymentEntity.error_reason || ''} ${paymentEntity.error_description || ''}`.trim(),
        };

        const diagnosed = await this.diagnosisService.diagnoseOpportunity(
          opp.id,
          errorDetails,
        );

        if (diagnosed && diagnosed.status === 'DIAGNOSED' && this.valuationService) {
          const valued = await this.valuationService.valueOpportunity(opp.id);
          if (this.aiExplanationService) {
            this.aiExplanationService
              .generateExplanation(
                diagnosed.cause || 'UNKNOWN_LEAKAGE',
                errorDetails.source,
                errorDetails.reason,
              )
              .catch(() => {});
          }

          // 4. Trigger Phase 08 Prioritization & Merchant Policy Pipeline
          if (valued && valued.status === 'VALUED' && this.prioritizationService) {
            const prioritized = await this.prioritizationService.prioritizeOpportunity(opp.id);
            if (prioritized && prioritized.status === 'PRIORITIZED' && this.policyEngineService) {
              const { opportunity: policyEvaluatedOpp } = await this.policyEngineService.evaluatePolicy(opp.id);
              return policyEvaluatedOpp || prioritized;
            }
            return prioritized || valued;
          }

          return valued || diagnosed;
        }

        return diagnosed || opp;
      }

      return opp || null;
    } catch (error: any) {
      this.logger.error(
        `Failed to create RecoveryOpportunity for payment ${paymentId}: ${error?.message}`,
      );
      throw error;
    }
  }
}
