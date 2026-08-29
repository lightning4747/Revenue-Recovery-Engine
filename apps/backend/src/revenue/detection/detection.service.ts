import { Injectable, Logger } from '@nestjs/common';
import { FailureDetectionService } from './failure-detection.service';
import { TelemetryService } from './telemetry.service';

export interface WebhookEventRecord {
  id: string;
  merchantId: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, any>;
}

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly failureDetectionService: FailureDetectionService,
  ) {}

  async processEvent(event: WebhookEventRecord): Promise<void> {
    if (!event || !event.merchantId) {
      this.logger.warn('DetectionService received invalid event without merchantId');
      return;
    }

    this.logger.log(
      `DETECTION_PROCESSING_EVENT: Ingesting event ${event.id} (${event.eventType}) for merchant ${event.merchantId}`,
    );

    // 1. Record telemetry for all incoming payment events
    await this.telemetryService.recordTelemetry(event.merchantId, event.payload);

    // 2. Failure Detection: If payment.failed event, instantiate RecoveryOpportunity
    if (event.eventType === 'payment.failed') {
      await this.failureDetectionService.processFailedPayment(
        event.merchantId,
        event.id,
        event.payload,
      );
    }
  }
}
