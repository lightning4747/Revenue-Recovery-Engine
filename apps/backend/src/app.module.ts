import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './common/config/env.validation';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MerchantModule } from './merchant/merchant.module';
import { WebhooksModule } from './razorpay/webhooks/webhooks.module';
import { DetectionModule } from './revenue/detection/detection.module';
import { DiagnosisModule } from './revenue/diagnosis/diagnosis.module';
import { ValuationModule } from './revenue/valuation/valuation.module';
import { AiExplanationModule } from './revenue/ai/ai-explanation.module';
import { OpportunityStateModule } from './recovery/state/opportunity-state.module';
import { PrioritizationModule } from './recovery/prioritization/prioritization.module';
import { PolicyModule } from './recovery/policy/policy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    MerchantModule,
    WebhooksModule,
    EventsModule,
    DetectionModule,
    DiagnosisModule,
    ValuationModule,
    AiExplanationModule,
    OpportunityStateModule,
    PrioritizationModule,
    PolicyModule,
  ],
})
export class AppModule {}
