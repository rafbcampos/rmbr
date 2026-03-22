import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { Database } from 'bun:sqlite';

export type DrizzleDatabase = BunSQLiteDatabase;

export function createDrizzle(db: Database): DrizzleDatabase {
  return drizzle(db);
}
