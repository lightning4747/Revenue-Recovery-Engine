import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PaymentLinksModule } from '../razorpay/payment-links/payment-links.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DatabaseModule, PaymentLinksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
