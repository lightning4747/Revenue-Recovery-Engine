import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';
import { recoveryOpportunities } from './recovery-opportunities.schema';

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 })
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  opportunityId: varchar('opportunity_id', { length: 64 }).references(
    () => recoveryOpportunities.id,
    { onDelete: 'cascade' },
  ),
  eventType: varchar('event_type', { length: 128 }).notNull(),
  actor: varchar('actor', { length: 64 }).notNull(),
  userExplanation: varchar('user_explanation', { length: 1024 }),
  technicalSnapshot: jsonb('technical_snapshot'),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
});
