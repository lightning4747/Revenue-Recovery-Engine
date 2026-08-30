import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
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

    // Fetch decrypted merchant credentials with environment fallback
    let credentials = await this.merchantService.getDecryptedCredentials(merchantId);
    if (!credentials || !credentials.keyId || credentials.keyId === 'rzp_test_default_key') {
      const envKeyId = process.env.RAZORPAY_KEY_ID;
      const envKeySecret = process.env.RAZORPAY_KEY_SECRET;
      if (envKeyId && envKeySecret) {
        credentials = {
          keyId: envKeyId,
          keySecret: envKeySecret,
          webhookSecret: process.env.WEBHOOK_SECRET || 'bow_webhook_secret_123',
        };
      }
    }

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
    const customerEmail = (opportunity as any).customerEmail || 'idontkniwhudhu@gmail.com';
    const customerContact = (opportunity as any).customerContact || '+919360220856';

    const payload = {
      amount: amountPaise,
      currency: opportunity.currency || 'INR',
      accept_partial: true,
      reference_id: referenceId,
      description: `Revenue Recovery link for transaction ${opportunity.originalTransactionId || opportunity.id}`,
      customer: {
        name: 'Customer',
        email: customerEmail,
        contact: customerContact,
      },
      notify: {
        sms: false,
        email: false,
        whatsapp: false,
      },
      notes: {
        opportunity_id: opportunity.id,
        original_order_id: opportunity.originalOrderId || 'N/A',
        original_payment_id: opportunity.originalTransactionId || 'N/A',
        merchant_id: merchantId,
      },
    };

    try {
      let response: { id: string; short_url: string; reference_id: string } | undefined;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await this.razorpayApiClient.createPaymentLink(
            credentials,
            payload,
          );
          lastErr = null;
          break;
        } catch (apiErr: any) {
          lastErr = apiErr;
          this.logger.warn(
            `RAZORPAY_API_RETRY_ATTEMPT_${attempt}: Failed to create payment link (${apiErr?.message}). Retrying in ${attempt * 500}ms...`,
          );
          await new Promise((r) => setTimeout(r, attempt * 500));
        }
      }

      if (!response) {
        // Try creating an official Razorpay Order via Orders API (no 30-link quota limit)
        try {
          const orderRes = await this.razorpayApiClient.createOrder(credentials, {
            amount: amountPaise,
            currency: opportunity.currency || 'INR',
            receipt: referenceId,
            notes: payload.notes,
          });

          const port = process.env.PORT || '3000';
          const sandboxBase = process.env.BASE_URL || `http://localhost:${port}`;
          const sandboxUrl = `${sandboxBase}/api/v1/sandbox/checkout?opp=${opportunity.id}&ref=${referenceId}&amount=${amountPaise}&merchant=${merchantId}&orderId=${orderRes.id}`;

          this.logger.log(
            `RAZORPAY_ORDER_CREATED_SUCCESS: Created official Razorpay Order ${orderRes.id} for reference ${referenceId}`,
          );

          response = {
            id: orderRes.id,
            short_url: sandboxUrl,
            reference_id: referenceId,
          };
        } catch (orderErr: any) {
          const port = process.env.PORT || '3000';
          const sandboxBase = process.env.BASE_URL || `http://localhost:${port}`;
          const sandboxUrl = `${sandboxBase}/api/v1/sandbox/checkout?opp=${opportunity.id}&ref=${referenceId}&amount=${amountPaise}&merchant=${merchantId}`;

          if (credentials.keyId.startsWith('rzp_test_') || process.env.ENABLE_MOCK_FALLBACK === 'true') {
            this.logger.warn(
              `RAZORPAY_TEST_MODE_FALLBACK: Razorpay API calls failed (${lastErr?.message}). Generating Sandbox Launch Link (${sandboxUrl}).`,
            );
            response = {
              id: `plink_${crypto.randomBytes(8).toString('hex')}`,
              short_url: sandboxUrl,
              reference_id: referenceId,
            };
          } else {
            this.logger.error(
              `RAZORPAY_API_CALL_FAILED: API request failed for reference_id ${referenceId}: ${lastErr?.message}`,
            );
            throw lastErr;
          }
        }
      }

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
