import type { Migration } from '../../core/migrator.ts';

export const todoMigrations: readonly Migration[] = [
  {
    version: 100,
    description: 'Create todos table',
    up: `
      CREATE TABLE todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_input TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'sketch',
        priority TEXT,
        due_date TEXT,
        goal_id INTEGER REFERENCES goals(id),
        enrichment_status TEXT NOT NULL DEFAULT 'raw',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    down: 'DROP TABLE IF EXISTS todos',
  },
  {
    version: 101,
    description: 'Create index on todos(status)',
    up: 'CREATE INDEX idx_todos_status ON todos(status)',
    down: 'DROP INDEX IF EXISTS idx_todos_status',
  },
];
