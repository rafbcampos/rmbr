import type { Migration } from '../../core/migrator.ts';

export const tilMigrations: readonly Migration[] = [
  {
    version: 400,
    description: 'Create til table',
    up: `CREATE TABLE til (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_input TEXT NOT NULL,
      title TEXT,
      content TEXT,
      domain TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      enrichment_status TEXT NOT NULL DEFAULT 'raw',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    down: 'DROP TABLE IF EXISTS til',
  },
  {
    version: 401,
    description: 'Create index on til domain',
    up: 'CREATE INDEX idx_til_domain ON til(domain)',
    down: 'DROP INDEX IF EXISTS idx_til_domain',
  },
  {
    version: 402,
    description: 'Create FTS5 virtual table for til full-text search',
    up: `CREATE VIRTUAL TABLE til_fts USING fts5(title, content, domain, content='til', content_rowid='id')`,
    down: 'DROP TABLE IF EXISTS til_fts',
  },
  {
    version: 403,
    description: 'Add deleted_at column to til',
    up: 'ALTER TABLE til ADD COLUMN deleted_at TEXT DEFAULT NULL',
    down: 'SELECT 1 -- SQLite does not support DROP COLUMN easily',
  },
];
