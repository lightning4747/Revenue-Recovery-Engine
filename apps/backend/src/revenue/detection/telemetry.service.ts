import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDb } from '../../database/database.provider';
import * as schema from '../../database/schema';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async recordTelemetry(
    merchantId: string,
    payload: Record<string, any>,
  ): Promise<void> {
    if (!merchantId) {
      this.logger.warn('Cannot record telemetry: missing merchantId');
      return;
    }

    const paymentEntity = payload?.payload?.payment?.entity || {};
    const eventType = payload?.event || '';

    const paymentMethod =
      typeof paymentEntity.method === 'string' && paymentEntity.method.trim() !== ''
        ? paymentEntity.method.toLowerCase()
        : 'unknown';

    const bankRaw =
      paymentEntity.bank ||
      paymentEntity.card?.network ||
      paymentEntity.issuer ||
      'UNKNOWN';
    const bank = typeof bankRaw === 'string' ? bankRaw.toUpperCase() : 'UNKNOWN';

    const isSuccess =
      eventType === 'payment.captured' ||
      eventType === 'payment_link.paid' ||
      paymentEntity.status === 'captured';

    const status = isSuccess ? 'success' : 'failed';

    let failureReason: string | undefined = undefined;
    if (!isSuccess) {
      const code = paymentEntity.error_code || '';
      const reason = paymentEntity.error_reason || paymentEntity.error_description || '';
      failureReason = `${code}: ${reason}`.replace(/^:\s*/, '').trim() || 'Payment failed';
    }

    const amount = Number(paymentEntity.amount || 0);
    const createdAtSeconds = paymentEntity.created_at || payload?.created_at;
    const timestamp = createdAtSeconds
      ? new Date(createdAtSeconds * 1000).toISOString()
      : new Date().toISOString();

    try {
      await this.db.insert(schema.paymentTelemetry).values({
        merchantId,
        paymentMethod,
        bank,
        status,
        failureReason,
        amount,
        timestamp,
      });

      this.logger.log(
        `TELEMETRY_RECORDED: Merchant ${merchantId} | Method: ${paymentMethod} | Bank: ${bank} | Status: ${status}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to record telemetry for merchant ${merchantId}: ${error?.message}`,
      );
      throw error;
    }
  }
}
