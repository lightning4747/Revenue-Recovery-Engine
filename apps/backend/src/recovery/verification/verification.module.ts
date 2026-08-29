import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpportunityStateModule } from '../state/opportunity-state.module';
import { LedgerTransactionService } from './ledger-transaction.service';
import { OutcomeVerificationService } from './outcome-verification.service';

@Module({
  imports: [DatabaseModule, OpportunityStateModule],
  providers: [LedgerTransactionService, OutcomeVerificationService],
  exports: [LedgerTransactionService, OutcomeVerificationService],
})
export class VerificationModule {}
