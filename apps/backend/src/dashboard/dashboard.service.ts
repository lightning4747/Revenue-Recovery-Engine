import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.provider';
import * as schema from '../database/schema';
import { OpportunityQueryDto } from './dto/opportunity-query.dto';
import { PaymentLinkActionService } from '../razorpay/payment-links/payment-link-action.service';

export interface DashboardSummaryResponse {
  revenueAtRiskPaise: number;
  expectedRecoverablePaise: number;
  verifiedRecoveredPaise: number;
  activeOpportunitiesCount: number;
  totalOpportunitiesCount: number;
  recoveryRatePercentage: number;
}

export interface AuditTrailItem {
  id: string;
  eventType: string;
  actor: string;
  userExplanation: string | null;
  timestamp: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Optional() @Inject(PaymentLinkActionService) private readonly paymentLinkActionService?: PaymentLinkActionService,
  ) {}

  async getSummary(merchantId: string): Promise<DashboardSummaryResponse> {
    const opps = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(eq(schema.recoveryOpportunities.merchantId, merchantId));

    let revenueAtRiskPaise = 0;
    let expectedRecoverablePaise = 0;
    let verifiedRecoveredPaise = 0;
    let activeOpportunitiesCount = 0;

    const finalStatuses = ['RECOVERED', 'FAILED', 'EXPIRED', 'UNRECOVERABLE'];

    for (const opp of opps) {
      const recovered = Number(opp.recoveredAmount || 0);
      verifiedRecoveredPaise += recovered;

      if (!finalStatuses.includes(opp.status)) {
        activeOpportunitiesCount++;
        revenueAtRiskPaise += Number(opp.remainingAmount || 0);
        expectedRecoverablePaise += Number(opp.expectedRecoveryValue || 0);
      }
    }

    const denominator = verifiedRecoveredPaise + revenueAtRiskPaise;
    const recoveryRatePercentage =
      denominator > 0
        ? Number(((verifiedRecoveredPaise / denominator) * 100).toFixed(2))
        : 0;

    return {
      revenueAtRiskPaise,
      expectedRecoverablePaise,
      verifiedRecoveredPaise,
      activeOpportunitiesCount,
      totalOpportunitiesCount: opps.length,
      recoveryRatePercentage,
    };
  }

  async getOpportunities(
    merchantId: string,
    query: OpportunityQueryDto,
  ): Promise<{
    data: Array<typeof schema.recoveryOpportunities.$inferSelect>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.recoveryOpportunities.merchantId, merchantId)];
    if (query.status) {
      conditions.push(eq(schema.recoveryOpportunities.status, query.status));
    }
    if (query.sourceType) {
      conditions.push(
        eq(schema.recoveryOpportunities.sourceType, query.sourceType),
      );
    }

    const whereClause = and(...conditions);

    const [oppList, countResult] = await Promise.all([
      this.db
        .select()
        .from(schema.recoveryOpportunities)
        .where(whereClause)
        .orderBy(desc(schema.recoveryOpportunities.priorityScore))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.recoveryOpportunities)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count || 0;

    return {
      data: oppList,
      total,
      page,
      limit,
    };
  }

  async getOpportunityById(
    merchantId: string,
    opportunityId: string,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect> {
    const opps = await this.db
      .select()
      .from(schema.recoveryOpportunities)
      .where(
        and(
          eq(schema.recoveryOpportunities.id, opportunityId),
          eq(schema.recoveryOpportunities.merchantId, merchantId),
        ),
      );

    if (opps.length === 0) {
      throw new NotFoundException(`Opportunity ${opportunityId} not found`);
    }

    return opps[0];
  }

  async getAuditTrail(
    merchantId: string,
    opportunityId: string,
  ): Promise<AuditTrailItem[]> {
    // Verify tenant ownership
    await this.getOpportunityById(merchantId, opportunityId);

    const auditRecords = await this.db
      .select({
        id: schema.auditEvents.id,
        eventType: schema.auditEvents.eventType,
        actor: schema.auditEvents.actor,
        userExplanation: schema.auditEvents.userExplanation,
        timestamp: schema.auditEvents.timestamp,
      })
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.merchantId, merchantId),
          eq(schema.auditEvents.opportunityId, opportunityId),
        ),
      )
      .orderBy(schema.auditEvents.timestamp);

    return auditRecords;
  }

  async approveOpportunity(
    merchantId: string,
    opportunityId: string,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect> {
    const opp = await this.getOpportunityById(merchantId, opportunityId);

    if (this.paymentLinkActionService) {
      const dispatched =
        await this.paymentLinkActionService.executePaymentLinkAction(
          opportunityId,
        );
      if (dispatched) {
        return dispatched;
      }
    }

    return opp;
  }

  async triggerRecovery(
    merchantId: string,
    opportunityId: string,
  ): Promise<typeof schema.recoveryOpportunities.$inferSelect> {
    return this.approveOpportunity(merchantId, opportunityId);
  }
}
