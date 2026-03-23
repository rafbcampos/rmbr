import { eq, sql } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { DrizzleDatabase } from '../core/drizzle.ts';
import { InvalidTransitionError } from '../core/errors.ts';

interface TransitionConfig<TStatus extends string> {
  readonly table: SQLiteTable & {
    id: SQLiteColumn;
    status: SQLiteColumn;
    updated_at: SQLiteColumn;
  };
  readonly entityName: string;
  readonly validTransitions: Record<TStatus, readonly TStatus[]>;
}

export function handleTransition<TStatus extends string>(
  db: DrizzleDatabase,
  config: TransitionConfig<TStatus>,
  id: number,
  currentStatus: TStatus,
  newStatus: TStatus,
): void {
  const allowed = config.validTransitions[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new InvalidTransitionError(config.entityName, currentStatus, newStatus);
  }

  db.update(config.table)
    .set({ status: newStatus, updated_at: sql`datetime('now')` })
    .where(eq(config.table.id, id))
    .run();
}
