import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record failed payment telemetry accurately', async () => {
    const valuesFn = jest.fn().mockResolvedValue({});
    mockDb.insert.mockReturnValue({ values: valuesFn });

    const payload = {
      event: 'payment.failed',
      created_at: 1787720000,
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_100',
            amount: 250000,
            method: 'card',
            card: { network: 'Visa' },
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Insufficient funds',
          },
        },
      },
    };

    await service.recordTelemetry('mer_123', payload);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(valuesFn).toHaveBeenCalledWith({
      merchantId: 'mer_123',
      paymentMethod: 'card',
      bank: 'VISA',
      status: 'failed',
      failureReason: 'BAD_REQUEST_ERROR: Insufficient funds',
      amount: 250000,
      timestamp: new Date(1787720000 * 1000).toISOString(),
    });
  });

  it('should record successful payment telemetry accurately', async () => {
    const valuesFn = jest.fn().mockResolvedValue({});
    mockDb.insert.mockReturnValue({ values: valuesFn });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_success_100',
            amount: 500000,
            method: 'upi',
            bank: 'HDFC',
            status: 'captured',
          },
        },
      },
    };

    await service.recordTelemetry('mer_123', payload);

    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'mer_123',
        paymentMethod: 'upi',
        bank: 'HDFC',
        status: 'success',
        failureReason: undefined,
        amount: 500000,
      }),
    );
  });
});
