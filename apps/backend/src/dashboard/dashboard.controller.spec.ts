import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockDashboardService: any;

  beforeEach(async () => {
    mockDashboardService = {
      getSummary: jest.fn().mockResolvedValue({
        revenueAtRiskPaise: 150000,
        expectedRecoverablePaise: 150000,
        verifiedRecoveredPaise: 600000,
        activeOpportunitiesCount: 1,
        totalOpportunitiesCount: 2,
        recoveryRatePercentage: 80,
      }),
      getOpportunities: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      getOpportunityById: jest.fn().mockResolvedValue({ id: 'opp_123' }),
      getAuditTrail: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get summary for authenticated merchant', async () => {
    const req = { user: { merchantId: 'm_100' } };
    const result = await controller.getSummary(req);

    expect(result.revenueAtRiskPaise).toBe(150000);
    expect(mockDashboardService.getSummary).toHaveBeenCalledWith('m_100');
  });

  it('should get audit trail for opportunity', async () => {
    const req = { user: { merchantId: 'm_100' } };
    const result = await controller.getAuditTrail(req, 'opp_123');

    expect(result).toEqual([]);
    expect(mockDashboardService.getAuditTrail).toHaveBeenCalledWith(
      'm_100',
      'opp_123',
    );
  });
});
