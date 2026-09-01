import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';
import { DetectionService } from '../../revenue/detection/detection.service';

import { OutcomeVerificationService } from '../../recovery/verification/outcome-verification.service';

export interface WebhookJobData {
  eventId: string;
  merchantId?: string;
}

@Processor('webhookQueue')
@Injectable()
export class WebhookEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookEventsProcessor.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Optional() private readonly detectionService?: DetectionService,
    @Optional() private readonly outcomeVerificationService?: OutcomeVerificationService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<any> {
    const eventId = job.data?.eventId;
    if (!eventId) {
      this.logger.warn(`Job ${job.id} missing eventId payload`);
      return;
    }

    // 1. Fetch WebhookEvent from DB
    const events = await this.db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, eventId));

    if (events.length === 0) {
      this.logger.warn(`WebhookEvent ${eventId} not found in database`);
      return;
    }

    const event = events[0];
    const merchantId = job.data?.merchantId || (event as any).merchantId || '';

    // 2. Layer 2 Worker Idempotency Check: if already PROCESSED, skip execution
    if (event.processingStatus === 'PROCESSED') {
      this.logger.log(
        `WORKER_IDEMPOTENCY_SKIP: WebhookEvent ${eventId} (${event.providerEventId}) is already PROCESSED. Skipping job.`,
      );
      return { skipped: true, reason: 'ALREADY_PROCESSED' };
    }

    // 3. Update status -> 'PROCESSING'
    await this.db
      .update(schema.webhookEvents)
      .set({ processingStatus: 'PROCESSING' })
      .where(eq(schema.webhookEvents.id, eventId));

    try {
      // 4. Domain Processing Pipeline
      this.logger.log(
        `WORKER_PROCESSING_EVENT: Processing event ${eventId} (${event.eventType})`,
      );

      const isOutcomeEvent =
        event.eventType.startsWith('payment_link.') ||
        event.eventType.startsWith('refund.') ||
        ['order.paid', 'order.expired', 'payment.captured', 'payment.authorized'].includes(event.eventType);

      if (isOutcomeEvent) {
        if (this.outcomeVerificationService) {
          await this.outcomeVerificationService.processPaymentLinkEvent(
            merchantId,
            event.eventType,
            event.payload as Record<string, any>,
          );
        }
      } else if (this.detectionService) {
        await this.detectionService.processEvent({
          id: event.id,
          merchantId,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payload: event.payload as Record<string, any>,
        });
      }

      // 5. Update processingStatus -> 'PROCESSED' with processedAt timestamp
      const now = new Date().toISOString();
      await this.db
        .update(schema.webhookEvents)
        .set({
          processingStatus: 'PROCESSED',
          processedAt: now,
        })
        .where(eq(schema.webhookEvents.id, eventId));

      this.logger.log(
        `WORKER_EVENT_PROCESSED: WebhookEvent ${eventId} (${event.eventType}) successfully processed.`,
      );

      return { success: true, eventId, processedAt: now };
    } catch (error: any) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts?.attempts || 3;

      this.logger.error(
        `WORKER_JOB_ERROR: Processing error on attempt ${attemptsMade + 1}/${maxAttempts} for event ${eventId}: ${error?.message}`,
      );

      // Check if total attempts exhausted (attemptsMade is 0-indexed count of prior failed attempts)
      if (attemptsMade + 1 >= maxAttempts) {
        this.logger.error(
          `WORKER_JOB_FAILED: Max attempts (${maxAttempts}) exhausted for event ${eventId}. Marking status FAILED.`,
        );
        await this.db
          .update(schema.webhookEvents)
          .set({
            processingStatus: 'FAILED',
            lastError: error?.message || 'Unknown processing error',
          })
          .where(eq(schema.webhookEvents.id, eventId));
      }

      throw error;
    }
  }
}
