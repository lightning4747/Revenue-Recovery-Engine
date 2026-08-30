import {
  pgTable,
  varchar,
  bigint,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';

export const merchantPolicies = pgTable('merchant_policies', {
  id: varchar('id', { length: 64 }).primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 })
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  minRecoveryAmount: bigint('min_recovery_amount', { mode: 'number' })
    .default(1000)
    .notNull(),
  maxRetryCount: integer('max_retry_count').default(3).notNull(),
  autoExecutionEnabled: boolean('auto_execution_enabled')
    .default(true)
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});
