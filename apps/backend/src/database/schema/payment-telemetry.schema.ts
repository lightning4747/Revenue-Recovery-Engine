import { pgTable, uuid, varchar, bigint, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';

export const paymentTelemetry = pgTable('payment_telemetry', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 })
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  paymentMethod: varchar('payment_method', { length: 64 }).notNull(),
  bank: varchar('bank', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  failureReason: varchar('failure_reason', { length: 255 }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
});
