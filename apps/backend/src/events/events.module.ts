import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { URL } from 'url';
import { DatabaseModule } from '../database/database.module';
import { DetectionModule } from '../revenue/detection/detection.module';
import { WebhookEventsProcessor } from './processors/webhook-events.processor';

@Module({
  imports: [
    DatabaseModule,
    DetectionModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');
        const parsedUrl = new URL(redisUrl);
        return {
          connection: {
            host: parsedUrl.hostname,
            port: Number(parsedUrl.port || 6379),
            password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
            username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'webhookQueue',
    }),
  ],
  providers: [WebhookEventsProcessor],
  exports: [BullModule],
})
export class EventsModule {}
