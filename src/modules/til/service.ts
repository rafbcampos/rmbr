import { eq, sql, count, desc, inArray, and, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity } from '../../shared/enrichment.ts';
import { DEFAULT_PAGINATION, paginateResults } from '../../shared/pagination.ts';
import type { Til } from './types.ts';
import { toTil } from './types.ts';
import { til } from './drizzle-schema.ts';

export interface TilFilters {
  readonly domain?: string;
}

export interface TilEnrichFields {
  readonly title?: string;
  readonly content?: string;
  readonly domain?: string;
  readonly tags?: string;
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
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): PaginatedResult<Til> {
    const conditions: SQL[] = [];

    if (filters.domain !== undefined) {
      conditions.push(eq(til.domain, filters.domain));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total = db.select({ value: count() }).from(til).where(whereClause).get()?.value ?? 0;

    const offset = (pagination.page - 1) * pagination.pageSize;
    const rows = db
      .select()
      .from(til)
      .where(whereClause)
      .orderBy(desc(til.created_at))
      .limit(pagination.pageSize)
      .offset(offset)
      .all();

    return paginateResults({ data: rows.map(toTil), total }, pagination);
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
      .where(inArray(til.id, ids))
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
    const updates: Record<string, string | number | null> = {};

    if (fields.title !== undefined) {
      updates['title'] = fields.title;
    }
    if (fields.content !== undefined) {
      updates['content'] = fields.content;
    }
    if (fields.domain !== undefined) {
      updates['domain'] = fields.domain;
    }
    if (fields.tags !== undefined) {
      updates['tags'] = fields.tags;
    }

    enrichEntity(db, til, 'til', id, updates);

    const enrichedTil = TilService.getById(db, id);

    db.run(
      sql`INSERT OR REPLACE INTO til_fts(rowid, title, content, domain) VALUES (${enrichedTil.id}, ${enrichedTil.title}, ${enrichedTil.content}, ${enrichedTil.domain})`,
    );

    return enrichedTil;
  },
};
