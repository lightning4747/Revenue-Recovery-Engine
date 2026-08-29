import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';
import { PaymentLinkActionService } from '../../razorpay/payment-links/payment-link-action.service';

export interface PolicyEvaluationResult {
  approved: boolean;
  reason: string;
}

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly stateMachineService: OpportunityStateMachineService,
    @Optional() @Inject(PaymentLinkActionService) private readonly paymentLinkActionService?: PaymentLinkActionService,
  ) {}

  async evaluatePolicy(
    opportunityId: string,
  ): Promise<{
    opportunity: typeof schema.recoveryOpportunities.$inferSelect | null;
    evaluation: PolicyEvaluationResult;
  }> {
    const opportunities = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opportunities.length === 0) {
      this.logger.warn(
        `PolicyEngineService: Opportunity ${opportunityId} not found`,
      );
      return {
        opportunity: null,
        evaluation: { approved: false, reason: 'OPPORTUNITY_NOT_FOUND' },
      };
    }

    const opportunity = opportunities[0];
    const merchantId = opportunity.merchantId;

    // Fetch Merchant Policy from DB
    const policies = await this.db
      .select()
      .from(schema.merchantPolicies)
      .where(eq(schema.merchantPolicies.merchantId, merchantId));

    const defaultPolicy = {
      minRecoveryAmount: 1000, // ₹10 default threshold in paise
      maxRetryCount: 3,
      autoExecutionEnabled: true,
    };

    const policy = policies.length > 0 ? policies[0] : defaultPolicy;

    const amount = Number(opportunity.amount || 0);
    const attemptCount = Number(opportunity.attemptCount || 0);
    const minAmount = Number(policy.minRecoveryAmount ?? 1000);
    const maxRetries = Number(policy.maxRetryCount ?? 3);
    const autoExecute = policy.autoExecutionEnabled ?? true;

    let evaluation: PolicyEvaluationResult;

    if (amount < minAmount) {
      evaluation = {
        approved: false,
        reason: `AMOUNT_BELOW_MINIMUM (Amount: ${amount} paise < Threshold: ${minAmount} paise)`,
      };
    } else if (attemptCount >= maxRetries) {
      evaluation = {
        approved: false,
        reason: `MAX_RETRIES_EXCEEDED (Attempt: ${attemptCount} >= Max: ${maxRetries})`,
      };
    } else if (!autoExecute) {
      evaluation = {
        approved: false,
        reason: 'AUTO_EXECUTION_DISABLED_BY_MERCHANT_POLICY',
      };
    } else {
      evaluation = {
        approved: true,
        reason: 'POLICY_RULES_PASSED_OK',
      };
    }

    let updatedOpp: typeof schema.recoveryOpportunities.$inferSelect | null =
      opportunity;

    if (evaluation.approved) {
      this.logger.log(
        `POLICY_APPROVED: Opportunity ${opportunityId} authorized for action dispatch`,
      );
      if (this.paymentLinkActionService) {
        const dispatchedOpp = await this.paymentLinkActionService.executePaymentLinkAction(
          opportunityId,
        );
        updatedOpp = dispatchedOpp || updatedOpp;
      } else {
        updatedOpp = await this.stateMachineService.transitionState(
          opportunityId,
          'ACTION_DISPATCHED',
          evaluation.reason,
        );
      }
    } else {
      // Transition PRIORITIZED -> POLICY_BLOCKED
      updatedOpp = await this.stateMachineService.transitionState(
        opportunityId,
        'POLICY_BLOCKED',
        evaluation.reason,
      );
      this.logger.warn(
        `POLICY_BLOCKED: Opportunity ${opportunityId} blocked by policy: ${evaluation.reason}`,
      );
    }

    return { opportunity: updatedOpp, evaluation };
  }
}
