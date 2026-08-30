import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ValuationService } from './valuation.service';

@Module({
  imports: [DatabaseModule],
  providers: [ValuationService],
  exports: [ValuationService],
})
export class ValuationModule {}
