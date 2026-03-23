import { eq, desc, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { KudosDirection, PaginatedResult, PaginationParams } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity, toUpdateRecord } from '../../shared/enrichment.ts';
import { listWithPagination } from '../../shared/list-with-pagination.ts';
import { softDelete, restore, notDeletedCondition } from '../../shared/soft-delete.ts';
import type { Kudos } from './types.ts';
import { toKudos } from './types.ts';
import { kudos as kudosTable } from './drizzle-schema.ts';

export interface KudosFilters {
  readonly direction?: KudosDirection | undefined;
  readonly person?: string | undefined;
  readonly goalId?: number | undefined;
  readonly includeDeleted?: boolean | undefined;
}

export interface KudosEnrichFields {
  readonly direction?: KudosDirection | undefined;
  readonly person?: string | undefined;
  readonly summary?: string | undefined;
  readonly context?: string | undefined;
  readonly goal_id?: number | undefined;
}

export const KudosService = {
  create(db: DrizzleDatabase, rawInput: string): Kudos {
    const row = db.insert(kudosTable).values({ raw_input: rawInput }).returning().get();
    return toKudos(row);
  },

  list(
    db: DrizzleDatabase,
    filters: KudosFilters = {},
    pagination?: PaginationParams,
  ): PaginatedResult<Kudos> {
    const conditions: SQL[] = [];

    if (filters.includeDeleted !== true) {
      conditions.push(notDeletedCondition(kudosTable.deleted_at));
    }

    if (filters.direction !== undefined) {
      conditions.push(eq(kudosTable.direction, filters.direction));
    }
    if (filters.person !== undefined) {
      conditions.push(eq(kudosTable.person, filters.person));
    }
    if (filters.goalId !== undefined) {
      conditions.push(eq(kudosTable.goal_id, filters.goalId));
    }

    return listWithPagination(
      db,
      { from: kudosTable, orderBy: desc(kudosTable.created_at), toEntity: toKudos },
      conditions,
      pagination,
    );
  },

  getById(db: DrizzleDatabase, id: number): Kudos {
    const row = db.select().from(kudosTable).where(eq(kudosTable.id, id)).get();
    if (!row) {
      throw new NotFoundError('kudos', id);
    }
    return toKudos(row);
  },

  enrich(db: DrizzleDatabase, id: number, fields: KudosEnrichFields): Kudos {
    enrichEntity(db, kudosTable, 'kudos', id, toUpdateRecord(fields));
    return KudosService.getById(db, id);
  },

  softDeleteEntity(db: DrizzleDatabase, id: number): void {
    softDelete(db, kudosTable, 'kudos', id);
  },

  restoreEntity(db: DrizzleDatabase, id: number): void {
    restore(db, kudosTable, 'kudos', id);
  },
};
