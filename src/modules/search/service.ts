import { desc, sql } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { notDeletedCondition } from '../../shared/soft-delete.ts';
import { todos } from '../todo/drizzle-schema.ts';
import { goals } from '../goals/drizzle-schema.ts';
import { kudos } from '../kudos/drizzle-schema.ts';
import { til } from '../til/drizzle-schema.ts';
import { studyTopics } from '../study/drizzle-schema.ts';
import { slackMessages } from '../slack/drizzle-schema.ts';
import { SearchEntityType, type SearchResult } from './types.ts';

const DEFAULT_LIMIT = 20;

interface FtsMatchRow {
  id: number;
}

function likePattern(query: string): string {
  return `%${query}%`;
}

interface SearchableEntity {
  readonly entityType: SearchEntityType;
  readonly searchByLike: (db: DrizzleDatabase, pattern: string) => SearchResult[];
}

const SEARCHABLE_ENTITIES: readonly SearchableEntity[] = [
  {
    entityType: SearchEntityType.Todo,
    searchByLike: (db, pattern) =>
      db
        .select({
          entity_id: todos.id,
          title: todos.title,
          raw_input: todos.raw_input,
          created_at: todos.created_at,
        })
        .from(todos)
        .where(
          sql`(${todos.title} LIKE ${pattern} OR ${todos.raw_input} LIKE ${pattern}) AND ${notDeletedCondition(todos.deleted_at)}`,
        )
        .orderBy(desc(todos.created_at))
        .all()
        .map(row => ({
          entity_type: SearchEntityType.Todo,
          entity_id: row.entity_id,
          title: row.title,
          snippet: row.title ?? row.raw_input,
          created_at: row.created_at,
        })),
  },
  {
    entityType: SearchEntityType.Goal,
    searchByLike: (db, pattern) =>
      db
        .select({
          entity_id: goals.id,
          title: goals.title,
          raw_input: goals.raw_input,
          created_at: goals.created_at,
        })
        .from(goals)
        .where(
          sql`(${goals.title} LIKE ${pattern} OR ${goals.raw_input} LIKE ${pattern}) AND ${notDeletedCondition(goals.deleted_at)}`,
        )
        .orderBy(desc(goals.created_at))
        .all()
        .map(row => ({
          entity_type: SearchEntityType.Goal,
          entity_id: row.entity_id,
          title: row.title,
          snippet: row.title ?? row.raw_input,
          created_at: row.created_at,
        })),
  },
  {
    entityType: SearchEntityType.Kudos,
    searchByLike: (db, pattern) =>
      db
        .select({
          entity_id: kudos.id,
          summary: kudos.summary,
          raw_input: kudos.raw_input,
          created_at: kudos.created_at,
        })
        .from(kudos)
        .where(
          sql`(${kudos.summary} LIKE ${pattern} OR ${kudos.raw_input} LIKE ${pattern}) AND ${notDeletedCondition(kudos.deleted_at)}`,
        )
        .orderBy(desc(kudos.created_at))
        .all()
        .map(row => ({
          entity_type: SearchEntityType.Kudos,
          entity_id: row.entity_id,
          title: row.summary,
          snippet: row.summary ?? row.raw_input,
          created_at: row.created_at,
        })),
  },
  {
    entityType: SearchEntityType.Study,
    searchByLike: (db, pattern) =>
      db
        .select({
          entity_id: studyTopics.id,
          title: studyTopics.title,
          raw_input: studyTopics.raw_input,
          created_at: studyTopics.created_at,
        })
        .from(studyTopics)
        .where(
          sql`(${studyTopics.title} LIKE ${pattern} OR ${studyTopics.raw_input} LIKE ${pattern}) AND ${notDeletedCondition(studyTopics.deleted_at)}`,
        )
        .orderBy(desc(studyTopics.created_at))
        .all()
        .map(row => ({
          entity_type: SearchEntityType.Study,
          entity_id: row.entity_id,
          title: row.title,
          snippet: row.title ?? row.raw_input,
          created_at: row.created_at,
        })),
  },
];

function searchTilByLike(db: DrizzleDatabase, pattern: string): SearchResult[] {
  return db
    .select({
      entity_id: til.id,
      title: til.title,
      raw_input: til.raw_input,
      created_at: til.created_at,
    })
    .from(til)
    .where(
      sql`(${til.title} LIKE ${pattern} OR ${til.raw_input} LIKE ${pattern}) AND ${notDeletedCondition(til.deleted_at)}`,
    )
    .orderBy(desc(til.created_at))
    .all()
    .map(row => ({
      entity_type: SearchEntityType.Til,
      entity_id: row.entity_id,
      title: row.title,
      snippet: row.title ?? row.raw_input,
      created_at: row.created_at,
    }));
}

function searchTilWithFts(db: DrizzleDatabase, query: string, pattern: string): SearchResult[] {
  try {
    const ftsRows = db.all<FtsMatchRow>(
      sql`SELECT rowid as id FROM til_fts WHERE til_fts MATCH ${query}`,
    );
    if (ftsRows.length > 0) {
      const ids = ftsRows.map(r => r.id);
      return db
        .select({
          entity_id: til.id,
          title: til.title,
          raw_input: til.raw_input,
          created_at: til.created_at,
        })
        .from(til)
        .where(
          sql`${til.id} IN (${sql.join(
            ids.map(id => sql`${id}`),
            sql`, `,
          )}) AND ${notDeletedCondition(til.deleted_at)}`,
        )
        .orderBy(desc(til.created_at))
        .all()
        .map(row => ({
          entity_type: SearchEntityType.Til,
          entity_id: row.entity_id,
          title: row.title,
          snippet: row.title ?? row.raw_input,
          created_at: row.created_at,
        }));
    }
    return [];
  } catch {
    return searchTilByLike(db, pattern);
  }
}

function searchSlack(db: DrizzleDatabase, pattern: string): SearchResult[] {
  return db
    .select({
      entity_id: slackMessages.id,
      raw_content: slackMessages.raw_content,
      channel: slackMessages.channel,
      created_at: slackMessages.created_at,
    })
    .from(slackMessages)
    .where(
      sql`${slackMessages.raw_content} LIKE ${pattern} AND ${notDeletedCondition(slackMessages.deleted_at)}`,
    )
    .orderBy(desc(slackMessages.created_at))
    .all()
    .map(row => ({
      entity_type: SearchEntityType.Slack,
      entity_id: row.entity_id,
      title: row.channel,
      snippet: row.raw_content,
      created_at: row.created_at,
    }));
}

export function search(
  db: DrizzleDatabase,
  query: string,
  limit?: number,
): readonly SearchResult[] {
  const maxResults = limit ?? DEFAULT_LIMIT;
  const pattern = likePattern(query);

  const combined: SearchResult[] = [];

  for (const entity of SEARCHABLE_ENTITIES) {
    combined.push(...entity.searchByLike(db, pattern));
  }

  combined.push(...searchTilWithFts(db, query, pattern));
  combined.push(...searchSlack(db, pattern));

  combined.sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0));

  return combined.slice(0, maxResults);
}
