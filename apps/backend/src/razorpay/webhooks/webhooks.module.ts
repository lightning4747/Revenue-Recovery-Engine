import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { WebhookVerificationService } from './verification/webhook-verification.service';
import { RazorpayWebhookController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RazorpayWebhookController],
  providers: [WebhooksService, WebhookVerificationService],
  exports: [WebhooksService, WebhookVerificationService],
})
export class WebhooksModule {}
