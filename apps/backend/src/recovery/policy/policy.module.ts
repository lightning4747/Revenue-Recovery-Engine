import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpportunityStateModule } from '../state/opportunity-state.module';
import { PolicyEngineService } from './policy-engine.service';

@Module({
  imports: [DatabaseModule, OpportunityStateModule],
  providers: [PolicyEngineService],
  exports: [PolicyEngineService],
})
export class PolicyModule {}
