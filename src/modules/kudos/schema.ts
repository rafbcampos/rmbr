import type { Migration } from '../../core/migrator.ts';

export const kudosMigrations: readonly Migration[] = [
  {
    version: 200,
    description: 'Create kudos table',
    up: `CREATE TABLE kudos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_input TEXT NOT NULL,
      direction TEXT,
      person TEXT,
      summary TEXT,
      context TEXT,
      goal_id INTEGER,
      enrichment_status TEXT NOT NULL DEFAULT 'raw',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    down: 'DROP TABLE IF EXISTS kudos',
  },
  {
    version: 201,
    description: 'Create index on kudos direction',
    up: 'CREATE INDEX idx_kudos_direction ON kudos(direction)',
    down: 'DROP INDEX IF EXISTS idx_kudos_direction',
  },
  {
    version: 202,
    description: 'Add deleted_at column to kudos',
    up: 'ALTER TABLE kudos ADD COLUMN deleted_at TEXT DEFAULT NULL',
    down: 'SELECT 1 -- SQLite does not support DROP COLUMN easily',
  },
];
