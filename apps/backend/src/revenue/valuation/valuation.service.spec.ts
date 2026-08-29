import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { ValuationService } from './valuation.service';

describe('ValuationService', () => {
  let service: ValuationService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValuationService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ValuationService>(ValuationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should compute ERV = round(amount * P_success) in integer paise and set status VALUED', async () => {
    const mockDiagnosedOpp = {
      id: 'opp_100',
      merchantId: 'mer_100',
      amount: 1000000, // ₹10,000 in paise
      recoveryProbability: 0.75,
      status: 'DIAGNOSED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockDiagnosedOpp]),
      }),
    });

    const mockValuedOpp = {
      ...mockDiagnosedOpp,
      expectedRecoveryValue: 750000, // ₹7,500 in paise
      interventionCost: 500,
      status: 'VALUED',
    };

    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockValuedOpp]),
      }),
    });
    mockDb.update.mockReturnValue({ set: updateSet });

    const result = await service.valueOpportunity('opp_100');

    expect(result).toEqual(mockValuedOpp);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRecoveryValue: 750000,
        interventionCost: 500,
        status: 'VALUED',
      }),
    );
  });
});
