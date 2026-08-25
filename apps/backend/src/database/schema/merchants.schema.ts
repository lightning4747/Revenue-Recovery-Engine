import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const merchants = pgTable('merchants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('INR'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});
