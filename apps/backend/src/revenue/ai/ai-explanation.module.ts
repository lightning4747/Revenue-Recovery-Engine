import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiExplanationService } from './ai-explanation.service';

@Module({
  imports: [ConfigModule],
  providers: [AiExplanationService],
  exports: [AiExplanationService],
})
export class AiExplanationModule {}
