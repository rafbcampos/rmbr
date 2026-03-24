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
  {
    version: 102,
    description: 'Add deleted_at column to todos',
    up: 'ALTER TABLE todos ADD COLUMN deleted_at TEXT DEFAULT NULL',
    down: 'SELECT 1 -- SQLite does not support DROP COLUMN easily',
  },
  {
    version: 103,
    description: 'Create todo_time_entries table',
    up: `
      CREATE TABLE todo_time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        todo_id INTEGER NOT NULL REFERENCES todos(id),
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        stopped_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_todo_time_entries_todo_id ON todo_time_entries(todo_id);
      CREATE INDEX idx_todo_time_entries_running ON todo_time_entries(stopped_at) WHERE stopped_at IS NULL;
    `,
    down: `
      DROP INDEX IF EXISTS idx_todo_time_entries_running;
      DROP INDEX IF EXISTS idx_todo_time_entries_todo_id;
      DROP TABLE IF EXISTS todo_time_entries;
    `,
  },
];
