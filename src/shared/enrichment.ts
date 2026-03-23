import { eq, sql } from 'drizzle-orm';
import type { DrizzleDatabase } from '../core/drizzle.ts';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { EnrichmentStatus } from '../core/types.ts';
import { NotFoundError } from '../core/errors.ts';

/**
 * Converts a typed enrich fields object into a Record suitable for Drizzle's
 * .set() method. Only includes fields that are not undefined.
 */
export function toUpdateRecord(fields: object): Record<string, string | number | null> {
  const updates: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates[key] = value;
    }
  }
  return updates;
}

export function enrichEntity(
  db: DrizzleDatabase,
  table: SQLiteTable & {
    id: SQLiteColumn;
    enrichment_status: SQLiteColumn;
    updated_at: SQLiteColumn;
  },
  tableName: string,
  id: number,
  updates: Record<string, string | number | null>,
): void {
  const row = db.select({ id: table.id }).from(table).where(eq(table.id, id)).get();
  if (!row) {
    throw new NotFoundError(tableName, id);
  }

  db.update(table)
    .set({
      ...updates,
      enrichment_status: EnrichmentStatus.Enriched,
      updated_at: sql`datetime('now')`,
    })
    .where(eq(table.id, id))
    .run();
}
