import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 64 }).notNull().default('razorpay'),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { mode: 'string' }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { mode: 'string' }),
    processingStatus: varchar('processing_status', { length: 32 })
      .notNull()
      .default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
  },
  (table) => [
    uniqueIndex('idx_provider_event').on(table.provider, table.providerEventId),
  ],
);
