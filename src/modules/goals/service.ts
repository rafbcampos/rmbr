import { eq, sql, and, desc, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { GoalStatus, PaginatedResult, PaginationParams, Quarter } from '../../core/types.ts';
import { GoalStatus as GoalStatusEnum } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity, toUpdateRecord } from '../../shared/enrichment.ts';
import { listWithPagination } from '../../shared/list-with-pagination.ts';
import { softDelete, restore, notDeletedCondition } from '../../shared/soft-delete.ts';
import { handleTransition } from '../../shared/transition.ts';
import type { Goal, QuarterlyReview, StarNarrative } from './types.ts';
import { toGoal, toQuarterlyReview, toStarNarrative } from './types.ts';
import { goals, goalStarNarratives, quarterlyReviews } from './drizzle-schema.ts';
import type { Todo } from '../todo/types.ts';
import { todoRowToEntity } from '../todo/types.ts';
import { todos } from '../todo/drizzle-schema.ts';
import type { Kudos } from '../kudos/types.ts';
import { toKudos } from '../kudos/types.ts';
import { kudos as kudosTable } from '../kudos/drizzle-schema.ts';
import type { StudyTopic } from '../study/types.ts';
import { toStudyTopic } from '../study/types.ts';
import { studyTopics } from '../study/drizzle-schema.ts';
import type { SlackMessage } from '../slack/types.ts';
import { toSlackMessage } from '../slack/types.ts';
import { slackMessages } from '../slack/drizzle-schema.ts';

const VALID_TRANSITIONS: Record<GoalStatus, readonly GoalStatus[]> = {
  [GoalStatusEnum.Draft]: [GoalStatusEnum.Active],
  [GoalStatusEnum.Active]: [GoalStatusEnum.Completed, GoalStatusEnum.Abandoned],
  [GoalStatusEnum.Completed]: [],
  [GoalStatusEnum.Abandoned]: [],
};

export interface GoalFilters {
  readonly status?: GoalStatus | undefined;
  readonly quarter?: Quarter | undefined;
  readonly year?: number | undefined;
  readonly includeDeleted?: boolean | undefined;
}

export interface GoalEnrichFields {
  readonly title?: string | undefined;
  readonly quarter?: Quarter | undefined;
  readonly year?: number | undefined;
  readonly kpis?: string | undefined;
}

export interface StarNarrativeInput {
  readonly situation: string;
  readonly task: string;
  readonly action: string;
  readonly result: string;
}

export interface QuarterlyReviewInput {
  readonly quarter: Quarter;
  readonly year: number;
  readonly what_went_well: string;
  readonly improvements: string;
  readonly kpi_summary: string;
  readonly generated_narrative: string;
}

export interface QuarterlyReviewData {
  readonly goals: readonly Goal[];
  readonly starNarratives: readonly StarNarrative[];
  readonly existingReview: QuarterlyReview | null;
}

export interface RelatedEntities {
  readonly todos: readonly Todo[];
  readonly kudos: readonly Kudos[];
  readonly studyTopics: readonly StudyTopic[];
  readonly slackMessages: readonly SlackMessage[];
}

export const GoalService = {
  create(db: DrizzleDatabase, rawInput: string): Goal {
    const row = db.insert(goals).values({ raw_input: rawInput }).returning().get();
    return toGoal(row);
  },

  list(
    db: DrizzleDatabase,
    filters?: GoalFilters,
    pagination?: PaginationParams,
  ): PaginatedResult<Goal> {
    const conditions: SQL[] = [];

    if (filters?.includeDeleted !== true) {
      conditions.push(notDeletedCondition(goals.deleted_at));
    }

    if (filters?.status !== undefined) {
      conditions.push(eq(goals.status, filters.status));
    }
    if (filters?.quarter !== undefined) {
      conditions.push(eq(goals.quarter, filters.quarter));
    }
    if (filters?.year !== undefined) {
      conditions.push(eq(goals.year, filters.year));
    }

    return listWithPagination(
      db,
      { from: goals, orderBy: desc(goals.created_at), toEntity: toGoal },
      conditions,
      pagination,
    );
  },

  getById(db: DrizzleDatabase, id: number): Goal {
    const row = db.select().from(goals).where(eq(goals.id, id)).get();
    if (!row) {
      throw new NotFoundError('goal', id);
    }
    return toGoal(row);
  },

  transition(db: DrizzleDatabase, id: number, newStatus: GoalStatus): Goal {
    const goal = GoalService.getById(db, id);
    handleTransition(
      db,
      { table: goals, entityName: 'goal', validTransitions: VALID_TRANSITIONS },
      goal.id,
      goal.status,
      newStatus,
    );
    return GoalService.getById(db, id);
  },

  enrich(db: DrizzleDatabase, id: number, fields: GoalEnrichFields): Goal {
    enrichEntity(db, goals, 'goals', id, toUpdateRecord(fields));
    return GoalService.getById(db, id);
  },

  addStarNarrative(
    db: DrizzleDatabase,
    goalId: number,
    narrative: StarNarrativeInput,
  ): StarNarrative {
    GoalService.getById(db, goalId);

    const row = db
      .insert(goalStarNarratives)
      .values({
        goal_id: goalId,
        situation: narrative.situation,
        task: narrative.task,
        action: narrative.action,
        result: narrative.result,
      })
      .returning()
      .get();

    return toStarNarrative(row);
  },

  getStarNarratives(db: DrizzleDatabase, goalId: number): readonly StarNarrative[] {
    GoalService.getById(db, goalId);

    const rows = db
      .select()
      .from(goalStarNarratives)
      .where(eq(goalStarNarratives.goal_id, goalId))
      .orderBy(desc(goalStarNarratives.created_at))
      .all();

    return rows.map(toStarNarrative);
  },

  getQuarterlyReviewData(db: DrizzleDatabase, quarter: Quarter, year: number): QuarterlyReviewData {
    const goalRows = db
      .select()
      .from(goals)
      .where(and(eq(goals.quarter, quarter), eq(goals.year, year)))
      .orderBy(desc(goals.created_at))
      .all();

    const goalEntities = goalRows.map(toGoal);

    const starNarratives: StarNarrative[] = [];
    for (const goal of goalEntities) {
      const narrativeRows = db
        .select()
        .from(goalStarNarratives)
        .where(eq(goalStarNarratives.goal_id, goal.id))
        .orderBy(desc(goalStarNarratives.created_at))
        .all();
      starNarratives.push(...narrativeRows.map(toStarNarrative));
    }

    const reviewRow = db
      .select()
      .from(quarterlyReviews)
      .where(and(eq(quarterlyReviews.quarter, quarter), eq(quarterlyReviews.year, year)))
      .get();

    const existingReview = reviewRow ? toQuarterlyReview(reviewRow) : null;

    return { goals: goalEntities, starNarratives, existingReview };
  },

  saveQuarterlyReview(db: DrizzleDatabase, review: QuarterlyReviewInput): QuarterlyReview {
    db.insert(quarterlyReviews)
      .values({
        quarter: review.quarter,
        year: review.year,
        what_went_well: review.what_went_well,
        improvements: review.improvements,
        kpi_summary: review.kpi_summary,
        generated_narrative: review.generated_narrative,
      })
      .onConflictDoUpdate({
        target: [quarterlyReviews.quarter, quarterlyReviews.year],
        set: {
          what_went_well: review.what_went_well,
          improvements: review.improvements,
          kpi_summary: review.kpi_summary,
          generated_narrative: review.generated_narrative,
          updated_at: sql`datetime('now')`,
        },
      })
      .run();

    const row = db
      .select()
      .from(quarterlyReviews)
      .where(
        and(eq(quarterlyReviews.quarter, review.quarter), eq(quarterlyReviews.year, review.year)),
      )
      .get();

    if (!row) {
      throw new NotFoundError('quarterly_review', 0);
    }

    return toQuarterlyReview(row);
  },

  getRelatedEntities(db: DrizzleDatabase, goalId: number): RelatedEntities {
    GoalService.getById(db, goalId);

    const todoRows = db
      .select()
      .from(todos)
      .where(and(eq(todos.goal_id, goalId), notDeletedCondition(todos.deleted_at)))
      .orderBy(desc(todos.id))
      .all();

    const kudosRows = db
      .select()
      .from(kudosTable)
      .where(and(eq(kudosTable.goal_id, goalId), notDeletedCondition(kudosTable.deleted_at)))
      .orderBy(desc(kudosTable.created_at))
      .all();

    const studyRows = db
      .select()
      .from(studyTopics)
      .where(and(eq(studyTopics.goal_id, goalId), notDeletedCondition(studyTopics.deleted_at)))
      .orderBy(desc(studyTopics.id))
      .all();

    const slackRows = db
      .select()
      .from(slackMessages)
      .where(and(eq(slackMessages.goal_id, goalId), notDeletedCondition(slackMessages.deleted_at)))
      .orderBy(desc(slackMessages.created_at))
      .all();

    return {
      todos: todoRows.map(todoRowToEntity),
      kudos: kudosRows.map(toKudos),
      studyTopics: studyRows.map(toStudyTopic),
      slackMessages: slackRows.map(toSlackMessage),
    };
  },

  softDeleteEntity(db: DrizzleDatabase, id: number): void {
    softDelete(db, goals, 'goal', id);
  },

  restoreEntity(db: DrizzleDatabase, id: number): void {
    restore(db, goals, 'goal', id);
  },
};
