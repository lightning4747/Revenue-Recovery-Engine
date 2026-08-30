import { Global, Module } from '@nestjs/common';
import { databaseProviders, DRIZZLE_DB } from './database.provider';
import { SeedService } from './seed.service';

@Global()
@Module({
  providers: [...databaseProviders, SeedService],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
