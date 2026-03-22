import { openMemoryDatabase } from '../../src/core/db.ts';
import type { Database } from 'bun:sqlite';
import { createDrizzle, type DrizzleDatabase } from '../../src/core/drizzle.ts';
import type { Migration } from '../../src/core/migrator.ts';
import { runMigrations } from '../../src/core/migrator.ts';

export function createTestDb(migrations: readonly Migration[] = []): DrizzleDatabase {
  const raw = openMemoryDatabase();
  if (migrations.length > 0) {
    runMigrations(raw, migrations);
  }
  return createDrizzle(raw);
}

export function createRawTestDb(): Database {
  return openMemoryDatabase();
}
