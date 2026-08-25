import {
  pgTable,
  uuid,
  varchar,
  real,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';

export const bankPerformanceBaselines = pgTable(
  'bank_performance_baselines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    merchantId: varchar('merchant_id', { length: 64 })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    paymentMethod: varchar('payment_method', { length: 64 }).notNull(),
    bank: varchar('bank', { length: 64 }).notNull(),
    baselineSuccessRate: real('baseline_success_rate').notNull(),
    currentSuccessRate: real('current_success_rate').notNull(),
    sampleCount: integer('sample_count').notNull(),
    degradationFlagged: boolean('degradation_flagged').default(false).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_bank_baseline').on(
      table.merchantId,
      table.paymentMethod,
      table.bank,
    ),
  ],
);
