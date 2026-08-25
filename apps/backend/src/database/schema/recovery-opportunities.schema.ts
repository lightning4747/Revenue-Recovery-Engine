import {
  pgTable,
  varchar,
  bigint,
  real,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';

export const recoveryOpportunities = pgTable('recovery_opportunities', {
  id: varchar('id', { length: 64 }).primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 })
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  sourceType: varchar('source_type', { length: 64 }).notNull(),
  sourceId: varchar('source_id', { length: 255 }).notNull(),
  originalTransactionId: varchar('original_transaction_id', { length: 255 }),
  originalOrderId: varchar('original_order_id', { length: 255 }),
  lastReferenceId: varchar('last_reference_id', { length: 255 }),
  lastPaymentLinkId: varchar('last_payment_link_id', { length: 255 }),
  lastPaymentLinkUrl: varchar('last_payment_link_url', { length: 512 }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  recoveredAmount: bigint('recovered_amount', { mode: 'number' }).default(0).notNull(),
  remainingAmount: bigint('remaining_amount', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 10 }).default('INR').notNull(),
  cause: varchar('cause', { length: 128 }),
  causeConfidence: real('cause_confidence'),
  recoveryProbability: real('recovery_probability'),
  interventionCost: bigint('intervention_cost', { mode: 'number' }),
  expectedRecoveryValue: bigint('expected_recovery_value', { mode: 'number' }),
  priorityScore: real('priority_score'),
  status: varchar('status', { length: 32 }).notNull().default('OBSERVED'),
  attemptCount: integer('attempt_count').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { mode: 'string' }),
});
