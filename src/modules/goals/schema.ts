import type { Migration } from '../../core/migrator.ts';

export const goalsMigrations: readonly Migration[] = [
  {
    version: 300,
    description: 'Create goals table',
    up: `
      CREATE TABLE goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_input TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        quarter TEXT,
        year INTEGER,
        kpis TEXT NOT NULL DEFAULT '[]',
        enrichment_status TEXT NOT NULL DEFAULT 'raw',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    down: 'DROP TABLE IF EXISTS goals',
  },
  {
    version: 301,
    description: 'Create goal_star_narratives table',
    up: `
      CREATE TABLE goal_star_narratives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        situation TEXT NOT NULL,
        task TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    down: 'DROP TABLE IF EXISTS goal_star_narratives',
  },
  {
    version: 302,
    description: 'Create quarterly_reviews table',
    up: `
      CREATE TABLE quarterly_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quarter TEXT NOT NULL,
        year INTEGER NOT NULL,
        what_went_well TEXT NOT NULL,
        improvements TEXT NOT NULL,
        kpi_summary TEXT NOT NULL,
        generated_narrative TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(quarter, year)
      )
    `,
    down: 'DROP TABLE IF EXISTS quarterly_reviews',
  },
  {
    version: 303,
    description: 'Create index on goals(quarter, year)',
    up: 'CREATE INDEX idx_goals_quarter_year ON goals(quarter, year)',
    down: 'DROP INDEX IF EXISTS idx_goals_quarter_year',
  },
];
