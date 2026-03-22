import type { Migration } from '../../core/migrator.ts';

export const tagsMigrations: readonly Migration[] = [
  {
    version: 700,
    description: 'Create tags and entity_tags tables',
    up: `
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE entity_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tag_id, entity_type, entity_id)
      );
      CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
      CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
    `,
    down: `
      DROP INDEX IF EXISTS idx_entity_tags_tag;
      DROP INDEX IF EXISTS idx_entity_tags_entity;
      DROP TABLE IF EXISTS entity_tags;
      DROP TABLE IF EXISTS tags;
    `,
  },
];
