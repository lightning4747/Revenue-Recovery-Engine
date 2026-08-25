import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.schema';

export const merchantCredentials = pgTable('merchant_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 })
    .notNull()
    .unique()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  keyId: varchar('key_id', { length: 255 }).notNull(),
  encryptedKeySecret: varchar('encrypted_key_secret', { length: 512 }).notNull(),
  encryptedWebhookSecret: varchar('encrypted_webhook_secret', { length: 512 }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});
