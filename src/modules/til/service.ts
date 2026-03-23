import { eq, sql, desc, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity, toUpdateRecord } from '../../shared/enrichment.ts';
import { listWithPagination } from '../../shared/list-with-pagination.ts';
import { softDelete, restore, notDeletedCondition } from '../../shared/soft-delete.ts';
import type { Til } from './types.ts';
import { toTil } from './types.ts';
import { til } from './drizzle-schema.ts';

export interface TilFilters {
  readonly domain?: string | undefined;
  readonly includeDeleted?: boolean | undefined;
}

export interface TilEnrichFields {
  readonly title?: string | undefined;
  readonly content?: string | undefined;
  readonly domain?: string | undefined;
  readonly tags?: string | undefined;
}

interface FtsMatchRow {
  id: number;
}

export const TilService = {
  create(db: DrizzleDatabase, rawInput: string): Til {
    const row = db.insert(til).values({ raw_input: rawInput }).returning().get();
    return toTil(row);
  },

  list(
    db: DrizzleDatabase,
    filters: TilFilters = {},
    pagination?: PaginationParams,
  ): PaginatedResult<Til> {
    const conditions: SQL[] = [];

    if (filters.includeDeleted !== true) {
      conditions.push(notDeletedCondition(til.deleted_at));
    }

    if (filters.domain !== undefined) {
      conditions.push(eq(til.domain, filters.domain));
    }

    return listWithPagination(
      db,
      { from: til, orderBy: desc(til.created_at), toEntity: toTil },
      conditions,
      pagination,
    );
  },

  getById(db: DrizzleDatabase, id: number): Til {
    const row = db.select().from(til).where(eq(til.id, id)).get();
    if (!row) {
      throw new NotFoundError('til', id);
    }
    return toTil(row);
  },

  search(db: DrizzleDatabase, query: string): readonly Til[] {
    const ftsRows = db.all<FtsMatchRow>(
      sql`SELECT rowid as id FROM til_fts WHERE til_fts MATCH ${query}`,
    );

    if (ftsRows.length === 0) {
      return [];
    }

    const ids = ftsRows.map(r => r.id);
    const rows = db
      .select()
      .from(til)
      .where(
        sql`${til.id} IN (${sql.join(
          ids.map(id => sql`${id}`),
          sql`, `,
        )}) AND ${notDeletedCondition(til.deleted_at)}`,
      )
      .orderBy(desc(til.created_at))
      .all();

    return rows.map(toTil);
  },

  getDomains(db: DrizzleDatabase): readonly string[] {
    const rows = db
      .selectDistinct({ domain: til.domain })
      .from(til)
      .where(sql`${til.domain} IS NOT NULL`)
      .orderBy(til.domain)
      .all();
    return rows.map(r => r.domain!);
  },

  enrich(db: DrizzleDatabase, id: number, fields: TilEnrichFields): Til {
    enrichEntity(db, til, 'til', id, toUpdateRecord(fields));

    const enrichedTil = TilService.getById(db, id);

    db.run(
      sql`INSERT OR REPLACE INTO til_fts(rowid, title, content, domain) VALUES (${enrichedTil.id}, ${enrichedTil.title}, ${enrichedTil.content}, ${enrichedTil.domain})`,
    );

    return enrichedTil;
  },

  softDeleteEntity(db: DrizzleDatabase, id: number): void {
    softDelete(db, til, 'til', id);
  },

  restoreEntity(db: DrizzleDatabase, id: number): void {
    restore(db, til, 'til', id);
  },
};
