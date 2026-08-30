import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpportunityStateModule } from '../state/opportunity-state.module';
import { PrioritizationService } from './prioritization.service';

@Module({
  imports: [DatabaseModule, OpportunityStateModule],
  providers: [PrioritizationService],
  exports: [PrioritizationService],
})
export class PrioritizationModule {}
