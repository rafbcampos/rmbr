import { eq, sql, desc, asc, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../../core/types.ts';
import { StudyStatus } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity, toUpdateRecord } from '../../shared/enrichment.ts';
import { parseStringArray } from '../../shared/json-array.ts';
import { listWithPagination } from '../../shared/list-with-pagination.ts';
import { softDelete, restore, notDeletedCondition } from '../../shared/soft-delete.ts';
import { handleTransition } from '../../shared/transition.ts';
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
  readonly status?: StudyStatus | undefined;
  readonly domain?: string | undefined;
  readonly goalId?: number | undefined;
  readonly includeDeleted?: boolean | undefined;
}

export interface EnrichFields {
  readonly title?: string | undefined;
  readonly domain?: string | undefined;
  readonly goal_id?: number | undefined;
}

export const StudyService = {
  create(db: DrizzleDatabase, rawInput: string): StudyTopic {
    const row = db.insert(studyTopics).values({ raw_input: rawInput }).returning().get();
    return toStudyTopic(row);
  },

  list(
    db: DrizzleDatabase,
    filters?: StudyFilters,
    pagination?: PaginationParams,
  ): PaginatedResult<StudyTopic> {
    const conditions: SQL[] = [];

    if (filters?.includeDeleted !== true) {
      conditions.push(notDeletedCondition(studyTopics.deleted_at));
    }

    if (filters?.status !== undefined) {
      conditions.push(eq(studyTopics.status, filters.status));
    }
    if (filters?.domain !== undefined) {
      conditions.push(eq(studyTopics.domain, filters.domain));
    }
    if (filters?.goalId !== undefined) {
      conditions.push(eq(studyTopics.goal_id, filters.goalId));
    }

    return listWithPagination(
      db,
      { from: studyTopics, orderBy: desc(studyTopics.id), toEntity: toStudyTopic },
      conditions,
      pagination,
    );
  },

  getById(db: DrizzleDatabase, id: number): StudyTopic {
    const row = db.select().from(studyTopics).where(eq(studyTopics.id, id)).get();
    if (!row) {
      throw new NotFoundError('study_topic', id);
    }
    return toStudyTopic(row);
  },

  transition(db: DrizzleDatabase, id: number, newStatus: StudyStatus): StudyTopic {
    const topic = StudyService.getById(db, id);
    handleTransition(
      db,
      { table: studyTopics, entityName: 'study_topic', validTransitions: VALID_TRANSITIONS },
      topic.id,
      topic.status,
      newStatus,
    );
    return StudyService.getById(db, id);
  },

  addNote(db: DrizzleDatabase, id: number, note: string): StudyTopic {
    const topic = StudyService.getById(db, id);
    const notes = parseStringArray(topic.notes);
    notes.push(note);

    db.update(studyTopics)
      .set({ notes: JSON.stringify(notes), updated_at: sql`datetime('now')` })
      .where(eq(studyTopics.id, id))
      .run();

    return StudyService.getById(db, id);
  },

  addResource(db: DrizzleDatabase, id: number, resource: string): StudyTopic {
    const topic = StudyService.getById(db, id);
    const resources = parseStringArray(topic.resources);
    resources.push(resource);

    db.update(studyTopics)
      .set({ resources: JSON.stringify(resources), updated_at: sql`datetime('now')` })
      .where(eq(studyTopics.id, id))
      .run();

    return StudyService.getById(db, id);
  },

  getNext(db: DrizzleDatabase): StudyTopic | null {
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
  },

  enrich(db: DrizzleDatabase, id: number, fields: EnrichFields): StudyTopic {
    enrichEntity(db, studyTopics, 'study_topics', id, toUpdateRecord(fields));
    return StudyService.getById(db, id);
  },

  softDeleteEntity(db: DrizzleDatabase, id: number): void {
    softDelete(db, studyTopics, 'study_topic', id);
  },

  restoreEntity(db: DrizzleDatabase, id: number): void {
    restore(db, studyTopics, 'study_topic', id);
  },
};
