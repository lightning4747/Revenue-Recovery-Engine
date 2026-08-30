import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { DegradationDetectionService } from './degradation-detection.service';

describe('DegradationDetectionService', () => {
  let service: DegradationDetectionService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DegradationDetectionService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<DegradationDetectionService>(DegradationDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip evaluation if sample count is less than 10', async () => {
    // 5 attempts total (3 success, 2 fail)
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue([
            {
              merchantId: 'mer_100',
              paymentMethod: 'card',
              bank: 'HDFC',
              totalAttempts: 5,
              successfulCount: 3,
            },
          ]),
        }),
      }),
    });

    const results = await service.evaluateDegradation('mer_100');
    expect(results).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should flag degradation anomaly and create RecoveryOpportunity when success rate drops > 20% below baseline', async () => {
    // 10 attempts total (4 success, 6 fail) -> 40.0% success rate (Baseline 85.0% -> drop of 45%)
    const selectChain = jest.fn();
    selectChain
      // 1st select: telemetry aggregates
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue([
              {
                merchantId: 'mer_100',
                paymentMethod: 'card',
                bank: 'ICICI',
                totalAttempts: 10,
                successfulCount: 4,
              },
            ]),
          }),
        }),
      })
      // 2nd select: bank_performance_baselines check (returns baseline = 85.0%)
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 'base_1',
              merchantId: 'mer_100',
              paymentMethod: 'card',
              bank: 'ICICI',
              baselineSuccessRate: 85.0,
            },
          ]),
        }),
      })
      // 3rd select: recovery_opportunities deduplication check (returns empty)
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

    mockDb.select = selectChain;

    const valuesFn = jest.fn().mockResolvedValue({});
    mockDb.insert.mockReturnValue({ values: valuesFn });

    const updateSetWhere = jest.fn().mockResolvedValue({});
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: updateSetWhere,
      }),
    });

    const results = await service.evaluateDegradation('mer_100');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        merchantId: 'mer_100',
        paymentMethod: 'card',
        bank: 'ICICI',
        totalAttempts: 10,
        currentSuccessRate: 40.0,
        baselineSuccessRate: 85.0,
        degradationFlagged: true,
      }),
    );

    expect(mockDb.update).toHaveBeenCalled(); // Update baseline degradationFlagged=true
    expect(mockDb.insert).toHaveBeenCalled(); // Create DEGRADATION RecoveryOpportunity
  });
});
