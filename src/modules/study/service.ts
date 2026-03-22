import { eq, sql, count, desc, asc, and, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../../core/types.ts';
import { StudyStatus, EnrichmentStatus } from '../../core/types.ts';
import { NotFoundError, InvalidTransitionError } from '../../core/errors.ts';
import { parseStringArray } from '../../shared/json-array.ts';
import { paginateResults, DEFAULT_PAGINATION } from '../../shared/pagination.ts';
import type { StudyTopic } from './types.ts';
import { toStudyTopic } from './types.ts';
import { studyTopics } from './drizzle-schema.ts';

const VALID_TRANSITIONS: Record<StudyStatus, readonly StudyStatus[]> = {
  [StudyStatus.Queued]: [StudyStatus.InProgress],
  [StudyStatus.InProgress]: [StudyStatus.Completed, StudyStatus.Parked],
  [StudyStatus.Completed]: [],
  [StudyStatus.Parked]: [StudyStatus.InProgress],
};

export interface StudyFilters {
  readonly status?: StudyStatus;
  readonly domain?: string;
  readonly goalId?: number;
}

export function create(db: DrizzleDatabase, rawInput: string): StudyTopic {
  const row = db.insert(studyTopics).values({ raw_input: rawInput }).returning().get();
  return toStudyTopic(row);
}

export function list(
  db: DrizzleDatabase,
  filters?: StudyFilters,
  pagination?: PaginationParams,
): PaginatedResult<StudyTopic> {
  const pag = pagination ?? DEFAULT_PAGINATION;
  const conditions: SQL[] = [];

  if (filters?.status !== undefined) {
    conditions.push(eq(studyTopics.status, filters.status));
  }
  if (filters?.domain !== undefined) {
    conditions.push(eq(studyTopics.domain, filters.domain));
  }
  if (filters?.goalId !== undefined) {
    conditions.push(eq(studyTopics.goal_id, filters.goalId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const total =
    db.select({ value: count() }).from(studyTopics).where(whereClause).get()?.value ?? 0;

  const offset = (pag.page - 1) * pag.pageSize;
  const rows = db
    .select()
    .from(studyTopics)
    .where(whereClause)
    .orderBy(desc(studyTopics.id))
    .limit(pag.pageSize)
    .offset(offset)
    .all();

  return paginateResults({ data: rows.map(toStudyTopic), total }, pag);
}

export function getById(db: DrizzleDatabase, id: number): StudyTopic {
  const row = db.select().from(studyTopics).where(eq(studyTopics.id, id)).get();
  if (!row) {
    throw new NotFoundError('study_topic', id);
  }
  return toStudyTopic(row);
}

export function transition(db: DrizzleDatabase, id: number, newStatus: StudyStatus): StudyTopic {
  const topic = getById(db, id);
  const allowed = VALID_TRANSITIONS[topic.status];

  if (!allowed.includes(newStatus)) {
    throw new InvalidTransitionError('study_topic', topic.status, newStatus);
  }

  db.update(studyTopics)
    .set({ status: newStatus, updated_at: sql`datetime('now')` })
    .where(eq(studyTopics.id, id))
    .run();

  return getById(db, id);
}

export function addNote(db: DrizzleDatabase, id: number, note: string): StudyTopic {
  const topic = getById(db, id);
  const notes = parseStringArray(topic.notes);
  notes.push(note);

  db.update(studyTopics)
    .set({ notes: JSON.stringify(notes), updated_at: sql`datetime('now')` })
    .where(eq(studyTopics.id, id))
    .run();

  return getById(db, id);
}

export function addResource(db: DrizzleDatabase, id: number, resource: string): StudyTopic {
  const topic = getById(db, id);
  const resources = parseStringArray(topic.resources);
  resources.push(resource);

  db.update(studyTopics)
    .set({ resources: JSON.stringify(resources), updated_at: sql`datetime('now')` })
    .where(eq(studyTopics.id, id))
    .run();

  return getById(db, id);
}

export function getNext(db: DrizzleDatabase): StudyTopic | null {
  const row = db
    .select()
    .from(studyTopics)
    .where(eq(studyTopics.status, StudyStatus.Queued))
    .orderBy(asc(studyTopics.id))
    .limit(1)
    .get();

  if (!row) {
    return null;
  }
  return toStudyTopic(row);
}

export interface EnrichFields {
  readonly title?: string | undefined;
  readonly domain?: string | undefined;
  readonly goal_id?: number | undefined;
}

export function enrich(db: DrizzleDatabase, id: number, fields: EnrichFields): StudyTopic {
  getById(db, id);

  const updates: Record<string, string | number> = {
    enrichment_status: EnrichmentStatus.Enriched,
  };

  if (fields.title !== undefined) {
    updates['title'] = fields.title;
  }
  if (fields.domain !== undefined) {
    updates['domain'] = fields.domain;
  }
  if (fields.goal_id !== undefined) {
    updates['goal_id'] = fields.goal_id;
  }

  db.update(studyTopics)
    .set({ ...updates, updated_at: sql`datetime('now')` })
    .where(eq(studyTopics.id, id))
    .run();

  return getById(db, id);
}
