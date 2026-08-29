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
  ],
})
export class AppModule {}
