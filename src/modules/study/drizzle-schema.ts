import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const studyTopics = sqliteTable('study_topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raw_input: text('raw_input').notNull(),
  title: text('title'),
  status: text('status').notNull().default('queued'),
  domain: text('domain'),
  notes: text('notes').notNull().default('[]'),
  resources: text('resources').notNull().default('[]'),
  goal_id: integer('goal_id'),
  enrichment_status: text('enrichment_status').notNull().default('raw'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
