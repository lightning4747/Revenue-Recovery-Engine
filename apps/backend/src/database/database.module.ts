import { Global, Module } from '@nestjs/common';
import { databaseProviders, DRIZZLE_DB } from './database.provider';

@Global()
@Module({
  providers: [...databaseProviders],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
