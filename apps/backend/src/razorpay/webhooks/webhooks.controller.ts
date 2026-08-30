import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBody,
} from '@nestjs/common';
import { BypassTransform } from '../../common/decorators/bypass-transform.decorator';
import { WebhooksService, WebhookHandlingResult } from './webhooks.service';

@Controller('api/v1/webhooks/razorpay')
@BypassTransform()
export class RazorpayWebhookController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':merchantId')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('merchantId') merchantId: string,
    @RawBody() rawBody?: Buffer,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventIdHeader?: string,
  ): Promise<WebhookHandlingResult> {
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Raw request body is required');
    }
    if (!signature) {
      throw new BadRequestException('Missing X-Razorpay-Signature header');
    }

    return this.webhooksService.handleWebhook(
      merchantId,
      rawBody,
      signature,
      eventIdHeader,
    );
  }
}
