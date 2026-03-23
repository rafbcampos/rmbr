import type { InferSelectModel, SQL } from 'drizzle-orm';
import { and, count } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DrizzleDatabase } from '../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../core/types.ts';
import { DEFAULT_PAGINATION, paginateResults } from './pagination.ts';

export interface ListConfig<TTable extends SQLiteTable, TEntity> {
  readonly from: TTable;
  readonly orderBy: SQL;
  readonly toEntity: (row: InferSelectModel<TTable>) => TEntity;
}

export function listWithPagination<TTable extends SQLiteTable, TEntity>(
  db: DrizzleDatabase,
  config: ListConfig<TTable, TEntity>,
  conditions: SQL[],
  pagination?: PaginationParams,
): PaginatedResult<TEntity> {
  const pag = pagination ?? DEFAULT_PAGINATION;
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const total =
    db.select({ value: count() }).from(config.from).where(whereClause).get()?.value ?? 0;

  const offset = (pag.page - 1) * pag.pageSize;
  const rows = db
    .select()
    .from(config.from)
    .where(whereClause)
    .orderBy(config.orderBy)
    .limit(pag.pageSize)
    .offset(offset)
    .all();

  return paginateResults({ data: rows.map(config.toEntity), total }, pag);
}
