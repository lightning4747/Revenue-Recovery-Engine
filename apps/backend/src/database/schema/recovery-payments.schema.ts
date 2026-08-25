import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';
import { recoveryOpportunities } from './recovery-opportunities.schema';

export const recoveryPayments = pgTable(
  'recovery_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    merchantId: varchar('merchant_id', { length: 64 })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    opportunityId: varchar('opportunity_id', { length: 64 })
      .notNull()
      .references(() => recoveryOpportunities.id, { onDelete: 'cascade' }),
    paymentLinkId: varchar('payment_link_id', { length: 255 }),
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 32 }).default('CAPTURED').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_merchant_payment').on(
      table.merchantId,
      table.razorpayPaymentId,
    ),
  ],
);
