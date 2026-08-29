import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { TaxonomyMapper } from './taxonomy.mapper';

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async diagnoseOpportunity(
    opportunityId: string,
    errorPayload?: Record<string, any>,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect | null> {
    const opportunities = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.id, opportunityId));

    if (opportunities.length === 0) {
      this.logger.warn(`DiagnosisService: Opportunity ${opportunityId} not found`);
      return null;
    }

    const opportunity = opportunities[0];

    // If already DIAGNOSED, VALUED, or UNRECOVERABLE, return current state
    if (
      opportunity.status === 'DIAGNOSED' ||
      opportunity.status === 'VALUED' ||
      opportunity.status === 'UNRECOVERABLE'
    ) {
      this.logger.log(
        `DIAGNOSIS_SKIPPED: Opportunity ${opportunityId} already in status ${opportunity.status}`,
      );
      return opportunity;
    }

    const source = errorPayload?.source || errorPayload?.error_source;
    const step = errorPayload?.step || errorPayload?.error_step;
    const reason =
      errorPayload?.reason ||
      errorPayload?.error_reason ||
      errorPayload?.error_code ||
      errorPayload?.error_description;

    const taxonomy = TaxonomyMapper.mapTaxonomy(source, step, reason);
    const now = new Date().toISOString();

    const targetStatus =
      taxonomy.recoverabilityClass === 'UNRECOVERABLE' || taxonomy.recoveryProbability === 0.0
        ? 'UNRECOVERABLE'
        : 'DIAGNOSED';

    const updated = await this.db
      .update(schema.recoveryOpportunities)
      .set({
        cause: taxonomy.cause,
        causeConfidence: taxonomy.causeConfidence,
        recoveryProbability: taxonomy.recoveryProbability,
        status: targetStatus,
        updatedAt: now,
      })
      .where(eq(schema.recoveryOpportunities.id, opportunityId))
      .returning();

    this.logger.log(
      `OPPORTUNITY_DIAGNOSED: Opportunity ${opportunityId} classified as ${taxonomy.cause} (P_success: ${taxonomy.recoveryProbability}, Status: ${targetStatus})`,
    );

    return updated[0] || null;
  }
}
