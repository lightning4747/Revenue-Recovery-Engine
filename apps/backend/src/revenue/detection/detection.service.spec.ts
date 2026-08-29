import { Test, TestingModule } from '@nestjs/testing';
import { DetectionService, WebhookEventRecord } from './detection.service';
import { FailureDetectionService } from './failure-detection.service';
import { TelemetryService } from './telemetry.service';

describe('DetectionService', () => {
  let service: DetectionService;
  let mockTelemetryService: any;
  let mockFailureDetectionService: any;

  beforeEach(async () => {
    mockTelemetryService = {
      recordTelemetry: jest.fn().mockResolvedValue(undefined),
    };
    mockFailureDetectionService = {
      processFailedPayment: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetectionService,
        { provide: TelemetryService, useValue: mockTelemetryService },
        { provide: FailureDetectionService, useValue: mockFailureDetectionService },
      ],
    }).compile();

    service = module.get<DetectionService>(DetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process payment.failed event by recording telemetry and triggering failure detection', async () => {
    const event: WebhookEventRecord = {
      id: 'evt_100',
      merchantId: 'mer_100',
      providerEventId: 'rzp_evt_100',
      eventType: 'payment.failed',
      payload: { event: 'payment.failed' },
    };

    await service.processEvent(event);

    expect(mockTelemetryService.recordTelemetry).toHaveBeenCalledWith(
      'mer_100',
      event.payload,
    );
    expect(mockFailureDetectionService.processFailedPayment).toHaveBeenCalledWith(
      'mer_100',
      'evt_100',
      event.payload,
    );
  });

  it('should record telemetry but NOT trigger failure detection for non-failure events', async () => {
    const event: WebhookEventRecord = {
      id: 'evt_200',
      merchantId: 'mer_100',
      providerEventId: 'rzp_evt_200',
      eventType: 'payment.captured',
      payload: { event: 'payment.captured' },
    };

    await service.processEvent(event);

    expect(mockTelemetryService.recordTelemetry).toHaveBeenCalledWith(
      'mer_100',
      event.payload,
    );
    expect(mockFailureDetectionService.processFailedPayment).not.toHaveBeenCalled();
  });
});
