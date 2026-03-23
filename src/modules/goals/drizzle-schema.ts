import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raw_input: text('raw_input').notNull(),
  title: text('title'),
  status: text('status').notNull().default('draft'),
  quarter: text('quarter'),
  year: integer('year'),
  kpis: text('kpis').notNull().default('[]'),
  enrichment_status: text('enrichment_status').notNull().default('raw'),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deleted_at: text('deleted_at'),
});

export const goalStarNarratives = sqliteTable('goal_star_narratives', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goal_id: integer('goal_id').notNull(),
  situation: text('situation').notNull(),
  task: text('task').notNull(),
  action: text('action').notNull(),
  result: text('result').notNull(),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const quarterlyReviews = sqliteTable('quarterly_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quarter: text('quarter').notNull(),
  year: integer('year').notNull(),
  what_went_well: text('what_went_well').notNull(),
  improvements: text('improvements').notNull(),
  kpi_summary: text('kpi_summary').notNull(),
  generated_narrative: text('generated_narrative').notNull(),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
