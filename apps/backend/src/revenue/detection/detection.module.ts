import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { DegradationDetectionService } from './degradation-detection.service';
import { DetectionService } from './detection.service';
import { FailureDetectionService } from './failure-detection.service';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
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
