import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../database/database.provider';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should compute financial summary metrics correctly', async () => {
    const mockOpps = [
      {
        id: 'opp_1',
        merchantId: 'm_100',
        amount: 250000,
        recoveredAmount: 100000,
        remainingAmount: 150000,
        expectedRecoveryValue: 150000,
        status: 'PARTIALLY_RECOVERED',
      },
      {
        id: 'opp_2',
        merchantId: 'm_100',
        amount: 500000,
        recoveredAmount: 500000,
        remainingAmount: 0,
        expectedRecoveryValue: 300000,
        status: 'RECOVERED',
      },
    ];

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(mockOpps),
      }),
    });

    const summary = await service.getSummary('m_100');

    expect(summary.verifiedRecoveredPaise).toBe(600000); // 100000 + 500000
    expect(summary.revenueAtRiskPaise).toBe(150000); // Only active opp_1
    expect(summary.expectedRecoverablePaise).toBe(150000);
    expect(summary.activeOpportunitiesCount).toBe(1);
    expect(summary.totalOpportunitiesCount).toBe(2);
    expect(summary.recoveryRatePercentage).toBe(80); // (600000 / 750000) * 100
  });

  it('should fetch sanitized audit trail excluding technical snapshots', async () => {
    const mockOpp = { id: 'opp_1', merchantId: 'm_100' };
    const mockAuditEvents = [
      {
        id: 'audit_1',
        eventType: 'OPPORTUNITY_OBSERVED',
        actor: 'DETECTION_ENGINE',
        userExplanation: 'Failure detected',
        timestamp: '2026-08-29T10:00:00Z',
      },
    ];

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return Promise.resolve([mockOpp]); // Opportunity exists
          return {
            orderBy: jest.fn().mockResolvedValue(mockAuditEvents),
          };
        }),
      }),
    }));

    const auditTrail = await service.getAuditTrail('m_100', 'opp_1');

    expect(auditTrail.length).toBe(1);
    expect(auditTrail[0].userExplanation).toBe('Failure detected');
    expect((auditTrail[0] as any).technicalSnapshot).toBeUndefined(); // MED-03 Sanitization
  });
});
