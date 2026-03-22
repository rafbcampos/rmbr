import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const til = sqliteTable('til', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raw_input: text('raw_input').notNull(),
  title: text('title'),
  content: text('content'),
  domain: text('domain'),
  tags: text('tags').notNull().default('[]'),
  enrichment_status: text('enrichment_status').notNull().default('raw'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
