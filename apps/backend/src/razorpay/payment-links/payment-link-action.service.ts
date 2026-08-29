import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { MerchantService } from '../../merchant/merchant.service';
import { OpportunityStateMachineService } from '../../recovery/state/opportunity-state-machine.service';
import { RazorpayApiClientService } from '../client/razorpay-api-client.service';

@Injectable()
export class PaymentLinkActionService {
  private readonly logger = new Logger(PaymentLinkActionService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly merchantService: MerchantService,
    private readonly razorpayApiClient: RazorpayApiClientService,
    private readonly stateMachineService: OpportunityStateMachineService,
  ) {}

  async executePaymentLinkAction(
    opportunityId: string,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect | null> {
    const opportunities = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opportunities.length === 0) {
      this.logger.warn(
        `PaymentLinkActionService: Opportunity ${opportunityId} not found`,
      );
      return null;
    }

    const opportunity = opportunities[0];
    const merchantId = opportunity.merchantId;

    // Fetch decrypted merchant credentials
    const credentials =
      await this.merchantService.getDecryptedCredentials(merchantId);
    if (!credentials || !credentials.keyId || !credentials.keySecret) {
      this.logger.warn(
        `PAYMENT_LINK_ACTION_FAILED: Missing or invalid Razorpay API credentials for merchant ${merchantId}`,
      );
      return opportunity;
    }

    const nextAttempt = (opportunity.attemptCount || 0) + 1;
    // Format reference_id: opp_<shortId>_att_<nextAttempt> (length <= 40 chars)
    const shortOppId = opportunity.id.substring(0, 24);
    const referenceId = `${shortOppId}_att_${nextAttempt}`;

    const amountPaise = Number(opportunity.amount || 0);

    const payload = {
      amount: amountPaise,
      currency: opportunity.currency || 'INR',
      accept_partial: true,
      reference_id: referenceId,
      description: `Revenue Recovery link for transaction ${opportunity.originalTransactionId || opportunity.id}`,
      notes: {
        opportunity_id: opportunity.id,
        original_order_id: opportunity.originalOrderId || 'N/A',
        original_payment_id: opportunity.originalTransactionId || 'N/A',
        merchant_id: merchantId,
      },
    };

    try {
      const response = await this.razorpayApiClient.createPaymentLink(
        credentials,
        payload,
      );

      // On success: update attemptCount, lastReferenceId, lastPaymentLinkId, lastPaymentLinkUrl
      await this.db
        .update(schema.recoveryOpportunities)
        .set({
          attemptCount: nextAttempt,
          lastReferenceId: referenceId,
          lastPaymentLinkId: response.id,
          lastPaymentLinkUrl: response.short_url,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.recoveryOpportunities.id, opportunityId));

      // Transition state PRIORITIZED -> ACTION_DISPATCHED
      const updatedOpp = await this.stateMachineService.transitionState(
        opportunityId,
        'ACTION_DISPATCHED',
        `PAYMENT_LINK_DISPATCHED_REF_${referenceId}`,
        {
          paymentLinkId: response.id,
          paymentLinkUrl: response.short_url,
          referenceId,
        },
      );

      this.logger.log(
        `PAYMENT_LINK_ACTION_SUCCESS: Dispatched Payment Link ${response.id} for opportunity ${opportunityId} (Url: ${response.short_url})`,
      );

      return updatedOpp;
    } catch (error: any) {
      this.logger.error(
        `PAYMENT_LINK_DISPATCH_FAILED: Failed to dispatch payment link for opportunity ${opportunityId}: ${error?.message}`,
      );
      throw error;
    }
  }
}
