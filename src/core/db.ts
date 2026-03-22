import { Database } from 'bun:sqlite';
import { createDrizzle, type DrizzleDatabase } from './drizzle.ts';

export function openDatabase(path: string): Database {
  const db = new Database(path);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA busy_timeout = 5000');
  return db;
}

export function openMemoryDatabase(): Database {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

export function openDrizzleDatabase(path: string): { raw: Database; drizzle: DrizzleDatabase } {
  const raw = openDatabase(path);
  return { raw, drizzle: createDrizzle(raw) };
}

export function openMemoryDrizzleDatabase(): { raw: Database; drizzle: DrizzleDatabase } {
  const raw = openMemoryDatabase();
  return { raw, drizzle: createDrizzle(raw) };
}
