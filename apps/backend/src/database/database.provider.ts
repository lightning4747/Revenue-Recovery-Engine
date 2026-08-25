import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_DB = 'DRIZZLE_DB';

export type DrizzleDb = NodePgDatabase<typeof schema>;

export const databaseProviders: Provider[] = [
  {
    provide: DRIZZLE_DB,
    inject: [ConfigService],
    useFactory: (configService: ConfigService): DrizzleDb => {
      const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
      const pool = new Pool({
        connectionString: databaseUrl,
      });
      return drizzle(pool, { schema });
    },
  },
];
