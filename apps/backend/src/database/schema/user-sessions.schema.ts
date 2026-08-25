import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 })
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 128 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});
