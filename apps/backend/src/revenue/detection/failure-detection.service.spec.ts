import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { FailureDetectionService } from './failure-detection.service';

describe('FailureDetectionService', () => {
  let service: FailureDetectionService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FailureDetectionService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<FailureDetectionService>(FailureDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process failed payment and create RecoveryOpportunity with status OBSERVED', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]), // No existing duplicate opportunity
      }),
    });

    const mockCreatedOpp = {
      id: 'opp_12345678',
      merchantId: 'mer_100',
      sourceType: 'FAILED_PAYMENT',
      sourceId: 'pay_fail_999',
      originalTransactionId: 'pay_fail_999',
      originalOrderId: 'order_999',
      amount: 150000,
      recoveredAmount: 0,
      remainingAmount: 150000,
      currency: 'INR',
      status: 'OBSERVED',
    };

    const valuesFn = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([mockCreatedOpp]),
    });
    mockDb.insert.mockReturnValue({ values: valuesFn });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_999',
            order_id: 'order_999',
            amount: 150000,
            currency: 'INR',
          },
        },
      },
    };

    const result = await service.processFailedPayment('mer_100', 'evt_1', payload);

    expect(result).toEqual(mockCreatedOpp);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'mer_100',
        sourceType: 'FAILED_PAYMENT',
        originalTransactionId: 'pay_fail_999',
        amount: 150000,
        status: 'OBSERVED',
      }),
    );
  });

  it('should skip creation and return existing opportunity if transaction already recorded', async () => {
    const existingOpp = {
      id: 'opp_existing_111',
      merchantId: 'mer_100',
      originalTransactionId: 'pay_duplicate_1',
      status: 'OBSERVED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([existingOpp]),
      }),
    });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_duplicate_1',
            amount: 10000,
          },
        },
      },
    };

    const result = await service.processFailedPayment('mer_100', 'evt_1', payload);

    expect(result).toEqual(existingOpp);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
