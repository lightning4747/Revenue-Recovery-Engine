import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DiagnosisService } from './diagnosis.service';

@Module({
  imports: [DatabaseModule],
  providers: [DiagnosisService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
