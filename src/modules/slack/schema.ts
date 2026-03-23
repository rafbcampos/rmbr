import type { Migration } from '../../core/migrator.ts';

export const slackMigrations: readonly Migration[] = [
  {
    version: 600,
    description: 'Create slack_messages table',
    up: `CREATE TABLE slack_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_content TEXT NOT NULL,
      channel TEXT,
      sender TEXT,
      message_ts TEXT,
      sentiment TEXT,
      processed INTEGER NOT NULL DEFAULT 0,
      todo_id INTEGER,
      goal_id INTEGER,
      enrichment_status TEXT NOT NULL DEFAULT 'raw',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    down: 'DROP TABLE IF EXISTS slack_messages',
  },
  {
    version: 601,
    description: 'Create index on slack_messages(channel)',
    up: 'CREATE INDEX idx_slack_messages_channel ON slack_messages(channel)',
    down: 'DROP INDEX IF EXISTS idx_slack_messages_channel',
  },
  {
    version: 602,
    description: 'Create index on slack_messages(processed)',
    up: 'CREATE INDEX idx_slack_messages_processed ON slack_messages(processed)',
    down: 'DROP INDEX IF EXISTS idx_slack_messages_processed',
  },
  {
    version: 603,
    description: 'Add raw_input column to slack_messages',
    up: `ALTER TABLE slack_messages ADD COLUMN raw_input TEXT NOT NULL DEFAULT '';
UPDATE slack_messages SET raw_input = raw_content WHERE raw_input = ''`,
    down: 'ALTER TABLE slack_messages DROP COLUMN raw_input',
  },
  {
    version: 604,
    description: 'Add deleted_at column to slack_messages',
    up: 'ALTER TABLE slack_messages ADD COLUMN deleted_at TEXT DEFAULT NULL',
    down: 'SELECT 1 -- SQLite does not support DROP COLUMN easily',
  },
];
