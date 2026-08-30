import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpportunityStateMachineService } from './opportunity-state-machine.service';

@Module({
  imports: [DatabaseModule],
  providers: [OpportunityStateMachineService],
  exports: [OpportunityStateMachineService],
})
export class OpportunityStateModule {}
