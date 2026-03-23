import { eq, sql, isNull, and } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { DrizzleDatabase } from '../core/drizzle.ts';
import { NotFoundError } from '../core/errors.ts';

/**
 * Soft-deletes an entity by setting deleted_at. Idempotent — does not
 * overwrite an existing deleted_at timestamp.
 *
 * Note: getById methods intentionally return soft-deleted entities so that
 * restore workflows can inspect them before restoring.
 */
export function softDelete(
  db: DrizzleDatabase,
  table: SQLiteTable & { id: SQLiteColumn; deleted_at: SQLiteColumn },
  tableName: string,
  id: number,
): void {
  const row = db.select({ id: table.id }).from(table).where(eq(table.id, id)).get();
  if (!row) {
    throw new NotFoundError(tableName, id);
  }
  db.update(table)
    .set({ deleted_at: sql`datetime('now')` })
    .where(and(eq(table.id, id), isNull(table.deleted_at)))
    .run();
}

export function restore(
  db: DrizzleDatabase,
  table: SQLiteTable & { id: SQLiteColumn; deleted_at: SQLiteColumn },
  tableName: string,
  id: number,
): void {
  const row = db.select({ id: table.id }).from(table).where(eq(table.id, id)).get();
  if (!row) {
    throw new NotFoundError(tableName, id);
  }
  db.update(table).set({ deleted_at: null }).where(eq(table.id, id)).run();
}

export function notDeletedCondition(column: SQLiteColumn): SQL {
  return isNull(column);
}
