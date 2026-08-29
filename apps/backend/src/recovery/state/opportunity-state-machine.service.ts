import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import {
  InvalidStateTransitionException,
  OpportunityState,
  StateTransitionMatrix,
} from './state-transition.matrix';

@Injectable()
export class OpportunityStateMachineService {
  private readonly logger = new Logger(OpportunityStateMachineService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async transitionState(
    opportunityId: string,
    targetState: OpportunityState,
    reason?: string,
    additionalMetadata?: Record<string, any>,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect | null> {
    const opportunities = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opportunities.length === 0) {
      this.logger.warn(
        `OpportunityStateMachineService: Opportunity ${opportunityId} not found`,
      );
      return null;
    }

    const opportunity = opportunities[0];
    const currentState = opportunity.status as OpportunityState;

    if (currentState === targetState) {
      this.logger.log(
        `STATE_TRANSITION_NOOP: Opportunity ${opportunityId} already in status '${targetState}'`,
      );
      return opportunity;
    }

    if (!StateTransitionMatrix.isValidTransition(currentState, targetState)) {
      this.logger.error(
        `ILLEGAL_STATE_TRANSITION_BLOCKED: Opportunity ${opportunityId} from '${currentState}' to '${targetState}'`,
      );
      throw new InvalidStateTransitionException(currentState, targetState);
    }

    const now = new Date().toISOString();

    // 1. Update opportunity status in DB
    const updated = await this.db
      .update(schema.recoveryOpportunities)
      .set({
        status: targetState,
        updatedAt: now,
        ...(additionalMetadata || {}),
      })
      .where(eq(schema.recoveryOpportunities.id, opportunityId))
      .returning();

    const updatedOpp = updated[0];

    // 2. Audit log state change into audit_events table
    try {
      await this.db.insert(schema.auditEvents).values({
        merchantId: opportunity.merchantId,
        opportunityId: opportunityId,
        eventType: `OPPORTUNITY_STATE_CHANGE_${currentState}_TO_${targetState}`,
        actor: 'STATE_MACHINE',
        userExplanation: reason || 'STATE_TRANSITION',
        technicalSnapshot: {
          previousState: currentState,
          newState: targetState,
          ...(additionalMetadata || {}),
        },
        timestamp: now,
      });
    } catch (auditErr: any) {
      this.logger.warn(
        `Failed to insert audit event for transition: ${auditErr?.message}`,
      );
    }

    this.logger.log(
      `OPPORTUNITY_STATE_TRANSITION: Opportunity ${opportunityId} transitioned from '${currentState}' -> '${targetState}'`,
    );

    return updatedOpp || null;
  }
}
