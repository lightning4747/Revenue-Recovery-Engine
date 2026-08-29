import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { eq, and, sql, gte } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';

export interface DegradationEvaluationResult {
  merchantId: string;
  paymentMethod: string;
  bank: string;
  totalAttempts: number;
  currentSuccessRate: number;
  baselineSuccessRate: number;
  degradationFlagged: boolean;
  opportunityId?: string;
}

@Injectable()
export class DegradationDetectionService {
  private readonly logger = new Logger(DegradationDetectionService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  // Cron task running every 5 minutes to evaluate rolling 1-hour bank degradation anomalies
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledDegradationCheck(): Promise<void> {
    this.logger.log('CRON_DEGRADATION_CHECK: Executing scheduled bank telemetry evaluation...');
    try {
      const results = await this.evaluateDegradation();
      const flagged = results.filter((r) => r.degradationFlagged);
      this.logger.log(
        `CRON_DEGRADATION_CHECK_COMPLETE: Evaluated ${results.length} telemetry streams. Flagged ${flagged.length} degradation anomalies.`,
      );
    } catch (error: any) {
      this.logger.error(`CRON_DEGRADATION_CHECK_FAILED: ${error?.message}`);
    }
  }

  async evaluateDegradation(
    targetMerchantId?: string,
  ): Promise<DegradationEvaluationResult[]> {
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 1. Aggregate payment_telemetry over trailing 1-hour window grouped by (merchantId, paymentMethod, bank)
    const telemetryQuery = this.db
      .select({
        merchantId: schema.paymentTelemetry.merchantId,
        paymentMethod: schema.paymentTelemetry.paymentMethod,
        bank: schema.paymentTelemetry.bank,
        totalAttempts: sql<number>`COUNT(*)::int`,
        successfulCount: sql<number>`SUM(CASE WHEN ${schema.paymentTelemetry.status} = 'success' THEN 1 ELSE 0 END)::int`,
      })
      .from(schema.paymentTelemetry)
      .where(gte(schema.paymentTelemetry.timestamp, oneHourAgoIso))
      .groupBy(
        schema.paymentTelemetry.merchantId,
        schema.paymentTelemetry.paymentMethod,
        schema.paymentTelemetry.bank,
      );

    const aggregates = await telemetryQuery;
    const results: DegradationEvaluationResult[] = [];

    for (const agg of aggregates) {
      if (targetMerchantId && agg.merchantId !== targetMerchantId) {
        continue;
      }

      const total = agg.totalAttempts || 0;
      const success = agg.successfulCount || 0;
      if (total < 10) {
        // FR-006 & HIGH-02: Require at least 10 telemetry samples in trailing 1h window
        continue;
      }

      const currentSuccessRate = (success / total) * 100.0;

      // 2. Fetch or initialize bank_performance_baselines
      const existingBaseline = await this.db
        .select()
        .from(schema.bankPerformanceBaselines)
        .where(
          and(
            eq(schema.bankPerformanceBaselines.merchantId, agg.merchantId),
            eq(schema.bankPerformanceBaselines.paymentMethod, agg.paymentMethod),
            eq(schema.bankPerformanceBaselines.bank, agg.bank),
          ),
        );

      let baselineSuccessRate = 85.0; // Default baseline if not previously recorded
      if (existingBaseline.length > 0) {
        baselineSuccessRate = existingBaseline[0].baselineSuccessRate;
      }

      // 3. Degradation Anomaly Threshold: Drop > 20.0% below baseline
      const isDegraded = currentSuccessRate < baselineSuccessRate - 20.0;
      const now = new Date().toISOString();

      // Upsert bank_performance_baselines
      if (existingBaseline.length === 0) {
        await this.db.insert(schema.bankPerformanceBaselines).values({
          merchantId: agg.merchantId,
          paymentMethod: agg.paymentMethod,
          bank: agg.bank,
          baselineSuccessRate,
          currentSuccessRate,
          sampleCount: total,
          degradationFlagged: isDegraded,
          updatedAt: now,
        });
      } else {
        await this.db
          .update(schema.bankPerformanceBaselines)
          .set({
            currentSuccessRate,
            sampleCount: total,
            degradationFlagged: isDegraded,
            updatedAt: now,
          })
          .where(eq(schema.bankPerformanceBaselines.id, existingBaseline[0].id));
      }

      let createdOpportunityId: string | undefined = undefined;

      // 4. Trigger DEGRADATION opportunity if degraded
      if (isDegraded) {
        const sourceId = `deg_${agg.merchantId}_${agg.paymentMethod}_${agg.bank}`;

        // Deduplication check: check if DEGRADATION opportunity already exists for this sourceId
        const existingOpp = await this.db
          .select()
          .from(schema.recoveryOpportunities)
          .where(
            and(
              eq(schema.recoveryOpportunities.merchantId, agg.merchantId),
              eq(schema.recoveryOpportunities.sourceId, sourceId),
              eq(schema.recoveryOpportunities.status, 'OBSERVED'),
            ),
          );

        if (existingOpp.length === 0) {
          const oppId = `opp_deg_${crypto.randomBytes(6).toString('hex')}`;
          await this.db.insert(schema.recoveryOpportunities).values({
            id: oppId,
            merchantId: agg.merchantId,
            sourceType: 'DEGRADATION',
            sourceId,
            originalTransactionId: null,
            originalOrderId: null,
            amount: 0, // Telemetry degradation aggregated opportunity
            recoveredAmount: 0,
            remainingAmount: 0,
            currency: 'INR',
            status: 'OBSERVED',
            createdAt: now,
            updatedAt: now,
          });

          createdOpportunityId = oppId;
          this.logger.warn(
            `DEGRADATION_ANOMALY_FLAGGED: Merchant ${agg.merchantId} | ${agg.paymentMethod}/${agg.bank} success rate dropped to ${currentSuccessRate.toFixed(1)}% (Baseline: ${baselineSuccessRate.toFixed(1)}%, Samples: ${total}). Opportunity ${oppId} created.`,
          );
        } else {
          createdOpportunityId = existingOpp[0].id;
        }
      }

      results.push({
        merchantId: agg.merchantId,
        paymentMethod: agg.paymentMethod,
        bank: agg.bank,
        totalAttempts: total,
        currentSuccessRate,
        baselineSuccessRate,
        degradationFlagged: isDegraded,
        opportunityId: createdOpportunityId,
      });
    }

    return results;
  }
}
