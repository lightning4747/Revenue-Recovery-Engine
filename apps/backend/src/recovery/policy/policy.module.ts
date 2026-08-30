import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpportunityStateModule } from '../state/opportunity-state.module';
import { PolicyEngineService } from './policy-engine.service';

import { PaymentLinksModule } from '../../razorpay/payment-links/payment-links.module';

@Module({
  imports: [DatabaseModule, OpportunityStateModule, PaymentLinksModule],
  providers: [PolicyEngineService],
  exports: [PolicyEngineService],
})
export class PolicyModule {}
