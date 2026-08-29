import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { DiagnosisModule } from '../diagnosis/diagnosis.module';
import { ValuationModule } from '../valuation/valuation.module';
import { AiExplanationModule } from '../ai/ai-explanation.module';
import { DegradationDetectionService } from './degradation-detection.service';
import { DetectionService } from './detection.service';
import { FailureDetectionService } from './failure-detection.service';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    DiagnosisModule,
    ValuationModule,
    AiExplanationModule,
  ],
  providers: [
    DetectionService,
    TelemetryService,
    FailureDetectionService,
    DegradationDetectionService,
  ],
  exports: [
    DetectionService,
    TelemetryService,
    FailureDetectionService,
    DegradationDetectionService,
  ],
})
export class DetectionModule {}
