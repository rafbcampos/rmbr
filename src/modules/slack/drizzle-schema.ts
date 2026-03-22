import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const slackMessages = sqliteTable('slack_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raw_input: text('raw_input').notNull().default(''),
  raw_content: text('raw_content').notNull(),
  channel: text('channel'),
  sender: text('sender'),
  message_ts: text('message_ts'),
  sentiment: text('sentiment'),
  processed: integer('processed').notNull().default(0),
  todo_id: integer('todo_id'),
  goal_id: integer('goal_id'),
  enrichment_status: text('enrichment_status').notNull().default('raw'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
