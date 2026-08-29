import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';
import { LedgerTransactionService } from './ledger-transaction.service';

@Injectable()
export class OutcomeVerificationService {
  private readonly logger = new Logger(OutcomeVerificationService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly ledgerTransactionService: LedgerTransactionService,
    private readonly stateMachineService: OpportunityStateMachineService,
  ) {}

  async processPaymentLinkEvent(
    merchantId: string,
    eventType: string,
    payload: any,
  ): Promise<{ success: boolean; opportunityId?: string; isDuplicate?: boolean }> {
    const rootPayload = payload?.payload || payload;
    const linkEntity = rootPayload?.payment_link?.entity || rootPayload?.payment_link || payload;
    const paymentEntity = rootPayload?.payment?.entity || rootPayload?.payment;

    let opportunityId =
      linkEntity?.notes?.opportunity_id ||
      payload?.notes?.opportunity_id;

    if (!opportunityId && linkEntity?.reference_id) {
      // reference_id format: opp_<shortId>_att_<attemptCount>
      const refId: string = linkEntity.reference_id;
      if (refId.startsWith('opp_')) {
        const parts = refId.split('_att_');
        opportunityId = parts[0];
      }
    }

    if (!opportunityId) {
      this.logger.warn(
        `OUTCOME_VERIFICATION_WARN: Could not correlate webhook event ${eventType} to Opportunity (Missing notes.opportunity_id or reference_id)`,
      );
      return { success: false };
    }

    // Verify opportunity exists for tenant isolation
    const opps = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opps.length === 0) {
      this.logger.warn(
        `OUTCOME_VERIFICATION_WARN: Opportunity ${opportunityId} not found for merchant ${merchantId}`,
      );
      return { success: false, opportunityId };
    }

    if (eventType === 'payment_link.partially_paid' || eventType === 'payment_link.paid') {
      const razorpayPaymentId = paymentEntity?.id;
      const capturedAmountPaise = Number(paymentEntity?.amount || linkEntity?.amount_paid || 0);

      if (!razorpayPaymentId) {
        this.logger.error(
          `OUTCOME_VERIFICATION_ERROR: Missing razorpayPaymentId in payment payload for ${eventType}`,
        );
        return { success: false, opportunityId };
      }

      const ledgerResult = await this.ledgerTransactionService.processPaymentLedger({
        merchantId,
        opportunityId,
        paymentLinkId: linkEntity?.id,
        razorpayPaymentId,
        capturedAmountPaise,
      });

      return {
        success: true,
        opportunityId,
        isDuplicate: ledgerResult.isDuplicate,
      };
    }

    if (eventType === 'payment_link.expired' || eventType === 'payment_link.cancelled') {
      const updatedOpp = await this.stateMachineService.transitionState(
        opportunityId,
        'EXPIRED',
        `LINK_${eventType.toUpperCase().replace('.', '_')}`,
      );

      this.logger.log(
        `OUTCOME_VERIFICATION_EXPIRED: Opportunity ${opportunityId} marked EXPIRED due to event ${eventType}`,
      );

      return { success: true, opportunityId };
    }

    return { success: true, opportunityId };
  }
}
