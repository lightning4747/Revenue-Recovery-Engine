import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { DiagnosisService } from './diagnosis.service';

describe('DiagnosisService', () => {
  let service: DiagnosisService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosisService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<DiagnosisService>(DiagnosisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should diagnose opportunity and transition status to DIAGNOSED', async () => {
    const mockObservedOpp = {
      id: 'opp_100',
      merchantId: 'mer_100',
      status: 'OBSERVED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockObservedOpp]),
      }),
    });

    const mockDiagnosedOpp = {
      ...mockObservedOpp,
      cause: 'CUSTOMER_AUTH_TIMEOUT',
      causeConfidence: 0.95,
      recoveryProbability: 0.75,
      status: 'DIAGNOSED',
    };

    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockDiagnosedOpp]),
      }),
    });
    mockDb.update.mockReturnValue({ set: updateSet });

    const result = await service.diagnoseOpportunity('opp_100', {
      source: 'customer',
      step: 'payment_authentication',
      reason: 'invalid_otp',
    });

    expect(result).toEqual(mockDiagnosedOpp);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: 'CUSTOMER_AUTH_TIMEOUT',
        causeConfidence: 0.95,
        recoveryProbability: 0.75,
        status: 'DIAGNOSED',
      }),
    );
  });

  it('should transition status to UNRECOVERABLE for unrecoverable errors', async () => {
    const mockObservedOpp = {
      id: 'opp_200',
      merchantId: 'mer_100',
      status: 'OBSERVED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockObservedOpp]),
      }),
    });

    const mockUnrecoverableOpp = {
      ...mockObservedOpp,
      cause: 'CARD_INVALID',
      causeConfidence: 0.99,
      recoveryProbability: 0.0,
      status: 'UNRECOVERABLE',
    };

    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockUnrecoverableOpp]),
      }),
    });
    mockDb.update.mockReturnValue({ set: updateSet });

    const result = await service.diagnoseOpportunity('opp_200', {
      reason: 'expired_card',
    });

    expect(result).toEqual(mockUnrecoverableOpp);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: 'CARD_INVALID',
        status: 'UNRECOVERABLE',
      }),
    );
  });
});
