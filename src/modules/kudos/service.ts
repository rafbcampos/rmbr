import { eq, count, desc, and, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { KudosDirection, PaginatedResult, PaginationParams } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity } from '../../shared/enrichment.ts';
import { DEFAULT_PAGINATION, paginateResults } from '../../shared/pagination.ts';
import type { Kudos } from './types.ts';
import { toKudos } from './types.ts';
import { kudos as kudosTable } from './drizzle-schema.ts';

export interface KudosFilters {
  readonly direction?: KudosDirection;
  readonly person?: string;
  readonly goalId?: number;
}

export interface KudosEnrichFields {
  readonly direction?: KudosDirection;
  readonly person?: string;
  readonly summary?: string;
  readonly context?: string;
  readonly goal_id?: number;
}

export const KudosService = {
  create(db: DrizzleDatabase, rawInput: string): Kudos {
    const row = db.insert(kudosTable).values({ raw_input: rawInput }).returning().get();
    return toKudos(row);
  },

  list(
    db: DrizzleDatabase,
    filters: KudosFilters = {},
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): PaginatedResult<Kudos> {
    const conditions: SQL[] = [];

    if (filters.direction !== undefined) {
      conditions.push(eq(kudosTable.direction, filters.direction));
    }
    if (filters.person !== undefined) {
      conditions.push(eq(kudosTable.person, filters.person));
    }
    if (filters.goalId !== undefined) {
      conditions.push(eq(kudosTable.goal_id, filters.goalId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total =
      db.select({ value: count() }).from(kudosTable).where(whereClause).get()?.value ?? 0;

    const offset = (pagination.page - 1) * pagination.pageSize;
    const rows = db
      .select()
      .from(kudosTable)
      .where(whereClause)
      .orderBy(desc(kudosTable.created_at))
      .limit(pagination.pageSize)
      .offset(offset)
      .all();

    return paginateResults({ data: rows.map(toKudos), total }, pagination);
  },

  getById(db: DrizzleDatabase, id: number): Kudos {
    const row = db.select().from(kudosTable).where(eq(kudosTable.id, id)).get();
    if (!row) {
      throw new NotFoundError('kudos', id);
    }
    return toKudos(row);
  },

  enrich(db: DrizzleDatabase, id: number, fields: KudosEnrichFields): Kudos {
    const updates: Record<string, string | number | null> = {};

    if (fields.direction !== undefined) {
      updates['direction'] = fields.direction;
    }
    if (fields.person !== undefined) {
      updates['person'] = fields.person;
    }
    if (fields.summary !== undefined) {
      updates['summary'] = fields.summary;
    }
    if (fields.context !== undefined) {
      updates['context'] = fields.context;
    }
    if (fields.goal_id !== undefined) {
      updates['goal_id'] = fields.goal_id;
    }

    enrichEntity(db, kudosTable, 'kudos', id, updates);
    return KudosService.getById(db, id);
  },
};
