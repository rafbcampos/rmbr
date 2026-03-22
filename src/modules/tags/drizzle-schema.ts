import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const entityTags = sqliteTable('entity_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tag_id: integer('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  entity_type: text('entity_type').notNull(),
  entity_id: integer('entity_id').notNull(),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
