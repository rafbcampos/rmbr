import type { Migration } from '../../core/migrator.ts';

export const studyMigrations: readonly Migration[] = [
  {
    version: 500,
    description: 'Create study_topics table',
    up: `
      CREATE TABLE study_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_input TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        domain TEXT,
        notes TEXT NOT NULL DEFAULT '[]',
        resources TEXT NOT NULL DEFAULT '[]',
        goal_id INTEGER REFERENCES goals(id),
        enrichment_status TEXT NOT NULL DEFAULT 'raw',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    down: 'DROP TABLE IF EXISTS study_topics',
  },
  {
    version: 501,
    description: 'Create index on study_topics(status)',
    up: 'CREATE INDEX idx_study_topics_status ON study_topics(status)',
    down: 'DROP INDEX IF EXISTS idx_study_topics_status',
  },
  {
    version: 502,
    description: 'Add deleted_at column to study_topics',
    up: 'ALTER TABLE study_topics ADD COLUMN deleted_at TEXT DEFAULT NULL',
    down: 'SELECT 1 -- SQLite does not support DROP COLUMN easily',
  },
];
