import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';

@Injectable()
export class ValuationService {
  private readonly logger = new Logger(ValuationService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async valueOpportunity(
    opportunityId: string,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect | null> {
    const opportunities = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opportunities.length === 0) {
      this.logger.warn(`ValuationService: Opportunity ${opportunityId} not found`);
      return null;
    }

    const opportunity = opportunities[0];

    // If already VALUED or UNRECOVERABLE, return current state
    if (opportunity.status === 'VALUED' || opportunity.status === 'UNRECOVERABLE') {
      this.logger.log(
        `VALUATION_SKIPPED: Opportunity ${opportunityId} already in status ${opportunity.status}`,
      );
      return opportunity;
    }

    const amount = Number(opportunity.amount || 0);
    const probability = Number(opportunity.recoveryProbability || 0.0);

    // Compute ERV = round(amount * P_success) in integer paise
    const expectedRecoveryValue = Math.round(amount * probability);

    // Estimate default intervention cost (e.g. 500 paise for automated re-engagement)
    const interventionCost = 500;

    const now = new Date().toISOString();

    const updated = await this.db
      .update(schema.recoveryOpportunities)
      .set({
        expectedRecoveryValue,
        interventionCost,
        status: 'VALUED',
        updatedAt: now,
      })
      .where(eq(schema.recoveryOpportunities.id, opportunityId))
      .returning();

    this.logger.log(
      `OPPORTUNITY_VALUED: Opportunity ${opportunityId} valued at ERV: ${expectedRecoveryValue} paise (Amount: ${amount}, P_success: ${probability})`,
    );

    return updated[0] || null;
  }
}
