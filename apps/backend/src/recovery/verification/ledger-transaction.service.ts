import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';

export interface PaymentLedgerInput {
  merchantId: string;
  opportunityId: string;
  paymentLinkId?: string;
  razorpayPaymentId: string;
  capturedAmountPaise: number;
}

@Injectable()
export class LedgerTransactionService {
  private readonly logger = new Logger(LedgerTransactionService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly stateMachineService: OpportunityStateMachineService,
  ) {}

  async processPaymentLedger(
    input: PaymentLedgerInput,
  ): Promise<{
    opportunity: typeof schema.recoveryOpportunities.$inferSelect | null;
    isDuplicate: boolean;
  }> {
    const {
      merchantId,
      opportunityId,
      paymentLinkId,
      razorpayPaymentId,
      capturedAmountPaise,
    } = input;

    // Check payment-level idempotency (Layer 3)
    const existingPayments = await this.db
      .select()
      .from(schema.recoveryPayments)
      .where(
        and(
          eq(schema.recoveryPayments.merchantId, merchantId),
          eq(schema.recoveryPayments.razorpayPaymentId, razorpayPaymentId),
        ),
      );

    if (existingPayments.length > 0) {
      this.logger.warn(
        `PAYMENT_IDEMPOTENCY_SKIP: Duplicate payment ${razorpayPaymentId} for merchant ${merchantId} already processed. Skipping ledger update.`,
      );
      const opps = await this.db
        .select()
        .from(schema.recoveryOpportunities)
        .where(eq(schema.recoveryOpportunities.id, opportunityId));

      return {
        opportunity: opps.length > 0 ? opps[0] : null,
        isDuplicate: true,
      };
    }

    // Fetch opportunity
    const opps = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opps.length === 0) {
      this.logger.error(`LEDGER_ERROR: Opportunity ${opportunityId} not found`);
      return { opportunity: null, isDuplicate: false };
    }

    const currentOpp = opps[0];
    const originalAmount = Number(currentOpp.amount || 0);
    const oldRecoveredAmount = Number(currentOpp.recoveredAmount || 0);

    const newRecoveredAmount = oldRecoveredAmount + capturedAmountPaise;
    const newRemainingAmount = Math.max(
      0,
      originalAmount - newRecoveredAmount,
    );
    const now = new Date().toISOString();

    // Insert RecoveryPayment record
    await this.db.insert(schema.recoveryPayments).values({
      merchantId,
      opportunityId,
      paymentLinkId: paymentLinkId || null,
      razorpayPaymentId,
      amount: capturedAmountPaise,
      status: 'CAPTURED',
      createdAt: now,
    });

    // Determine state transition & resolvedAt
    const nextStatus =
      newRemainingAmount === 0 ? 'RECOVERED' : 'PARTIALLY_RECOVERED';
    const resolvedAt = nextStatus === 'RECOVERED' ? now : currentOpp.resolvedAt;

    // Update opportunity ledger
    await this.db
      .update(schema.recoveryOpportunities)
      .set({
        recoveredAmount: newRecoveredAmount,
        remainingAmount: newRemainingAmount,
        resolvedAt: resolvedAt || null,
        updatedAt: now,
      })
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    // Transition state
    const updatedOpp = await this.stateMachineService.transitionState(
      opportunityId,
      nextStatus,
      `PAYMENT_VERIFIED_CAPTURED_${capturedAmountPaise}_PAISE`,
      {
        razorpayPaymentId,
        capturedAmountPaise,
        newRecoveredAmount,
        newRemainingAmount,
      },
    );

    this.logger.log(
      `LEDGER_UPDATE_SUCCESS: Opportunity ${opportunityId} updated. Recovered: ${newRecoveredAmount} paise, Remaining: ${newRemainingAmount} paise, Status: ${nextStatus}`,
    );

    return { opportunity: updatedOpp, isDuplicate: false };
  }
}
