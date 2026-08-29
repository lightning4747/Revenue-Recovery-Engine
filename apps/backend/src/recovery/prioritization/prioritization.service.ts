import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';

@Injectable()
export class PrioritizationService {
  private readonly logger = new Logger(PrioritizationService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly stateMachineService: OpportunityStateMachineService,
  ) {}

  async prioritizeOpportunity(
    opportunityId: string,
    urgencyMultiplier = 1.0,
    customerLtvWeight = 1.0,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect | null> {
    const opportunities = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opportunities.length === 0) {
      this.logger.warn(
        `PrioritizationService: Opportunity ${opportunityId} not found`,
      );
      return null;
    }

    const opportunity = opportunities[0];

    // If already PRIORITIZED or further down lifecycle, return current state
    if (
      opportunity.status === 'PRIORITIZED' ||
      opportunity.status === 'ACTION_DISPATCHED'
    ) {
      this.logger.log(
        `PRIORITIZATION_SKIPPED: Opportunity ${opportunityId} already in status ${opportunity.status}`,
      );
      return opportunity;
    }

    const erv = Number(opportunity.expectedRecoveryValue || 0);

    // Compute priorityScore = ERV * urgencyMultiplier * customerLtvWeight
    const priorityScore = erv * urgencyMultiplier * customerLtvWeight;

    // Transition state from VALUED -> PRIORITIZED with priorityScore update
    const updatedOpp = await this.stateMachineService.transitionState(
      opportunityId,
      'PRIORITIZED',
      'PRIORITIZATION_RANKING_COMPLETE',
      { priorityScore },
    );

    this.logger.log(
      `OPPORTUNITY_PRIORITIZED: Opportunity ${opportunityId} computed Priority Score: ${priorityScore} (ERV: ${erv})`,
    );

    return updatedOpp;
  }
}
