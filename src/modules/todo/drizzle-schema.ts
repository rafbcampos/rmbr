import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const todoTimeEntries = sqliteTable('todo_time_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  todo_id: integer('todo_id').notNull(),
  started_at: text('started_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  stopped_at: text('stopped_at'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raw_input: text('raw_input').notNull(),
  title: text('title'),
  status: text('status').notNull().default('sketch'),
  priority: text('priority'),
  due_date: text('due_date'),
  goal_id: integer('goal_id'),
  enrichment_status: text('enrichment_status').notNull().default('raw'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deleted_at: text('deleted_at'),
});
