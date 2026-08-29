import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { AiExplanationService } from '../ai/ai-explanation.service';
import { FallbackTemplateGenerator } from '../ai/fallback-template.generator';
import { DiagnosisService } from '../diagnosis/diagnosis.service';
import { ValuationService } from '../valuation/valuation.service';
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
    ConfigModule,
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
