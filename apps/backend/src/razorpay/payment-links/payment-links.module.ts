import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MerchantModule } from '../../merchant/merchant.module';
import { OpportunityStateModule } from '../../recovery/state/opportunity-state.module';
import { RazorpayApiClientService } from '../client/razorpay-api-client.service';
import { PaymentLinkActionService } from './payment-link-action.service';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    MerchantModule,
    OpportunityStateModule,
  ],
  providers: [RazorpayApiClientService, PaymentLinkActionService],
  exports: [RazorpayApiClientService, PaymentLinkActionService],
})
export class PaymentLinksModule {}
