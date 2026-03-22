import type { Database } from 'bun:sqlite';
import { DatabaseError } from './errors.ts';

export interface Migration {
  readonly version: number;
  readonly description: string;
  readonly up: string;
  readonly down: string;
}

function ensureMigrationsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function getAppliedVersions(db: Database): readonly number[] {
  ensureMigrationsTable(db);
  interface VersionRow {
    version: number;
  }
  const rows = db.query<VersionRow, []>('SELECT version FROM _migrations ORDER BY version').all();
  return rows.map(r => r.version);
}

export function runMigrations(db: Database, migrations: readonly Migration[]): void {
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedVersions(db));
  const pending = [...migrations]
    .filter(m => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const tx = db.transaction(() => {
      try {
        db.run(migration.up);
        db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(
          migration.version,
          migration.description,
        );
      } catch (err) {
        throw new DatabaseError(
          `Migration ${migration.version} (${migration.description}) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    tx();
  }
}

export function rollbackMigrations(
  db: Database,
  migrations: readonly Migration[],
  targetVersion: number,
): void {
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedVersions(db));
  const toRollback = [...migrations]
    .filter(m => applied.has(m.version) && m.version > targetVersion)
    .sort((a, b) => b.version - a.version);

  for (const migration of toRollback) {
    const tx = db.transaction(() => {
      try {
        db.run(migration.down);
        db.prepare('DELETE FROM _migrations WHERE version = ?').run(migration.version);
      } catch (err) {
        throw new DatabaseError(
          `Rollback of migration ${migration.version} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    tx();
  }
}
