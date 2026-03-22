import { eq, sql, count, desc, and, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { GoalStatus, PaginatedResult, PaginationParams, Quarter } from '../../core/types.ts';
import { GoalStatus as GoalStatusEnum } from '../../core/types.ts';
import { InvalidTransitionError, NotFoundError } from '../../core/errors.ts';
import { enrichEntity } from '../../shared/enrichment.ts';
import { DEFAULT_PAGINATION, paginateResults } from '../../shared/pagination.ts';
import type { Goal, QuarterlyReview, StarNarrative } from './types.ts';
import { toGoal, toQuarterlyReview, toStarNarrative } from './types.ts';
import { goals, goalStarNarratives, quarterlyReviews } from './drizzle-schema.ts';

const VALID_TRANSITIONS: Record<string, readonly GoalStatus[]> = {
  [GoalStatusEnum.Draft]: [GoalStatusEnum.Active],
  [GoalStatusEnum.Active]: [GoalStatusEnum.Completed, GoalStatusEnum.Abandoned],
  [GoalStatusEnum.Completed]: [],
  [GoalStatusEnum.Abandoned]: [],
};

export interface GoalFilters {
  readonly status?: GoalStatus | undefined;
  readonly quarter?: Quarter | undefined;
  readonly year?: number | undefined;
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

export function create(db: DrizzleDatabase, rawInput: string): Goal {
  const row = db.insert(goals).values({ raw_input: rawInput }).returning().get();
  return toGoal(row);
}

export function list(
  db: DrizzleDatabase,
  filters?: GoalFilters,
  pagination?: PaginationParams,
): PaginatedResult<Goal> {
  const pag = pagination ?? DEFAULT_PAGINATION;
  const conditions: SQL[] = [];

  if (filters?.status !== undefined) {
    conditions.push(eq(goals.status, filters.status));
  }
  if (filters?.quarter !== undefined) {
    conditions.push(eq(goals.quarter, filters.quarter));
  }
  if (filters?.year !== undefined) {
    conditions.push(eq(goals.year, filters.year));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const total = db.select({ value: count() }).from(goals).where(whereClause).get()?.value ?? 0;

  const offset = (pag.page - 1) * pag.pageSize;
  const rows = db
    .select()
    .from(goals)
    .where(whereClause)
    .orderBy(desc(goals.created_at))
    .limit(pag.pageSize)
    .offset(offset)
    .all();

  return paginateResults({ data: rows.map(toGoal), total }, pag);
}

export function getById(db: DrizzleDatabase, id: number): Goal {
  const row = db.select().from(goals).where(eq(goals.id, id)).get();
  if (!row) {
    throw new NotFoundError('goal', id);
  }
  return toGoal(row);
}

export function transition(db: DrizzleDatabase, id: number, newStatus: GoalStatus): Goal {
  const goal = getById(db, id);
  const allowed = VALID_TRANSITIONS[goal.status] ?? [];

  if (!allowed.includes(newStatus)) {
    throw new InvalidTransitionError('goal', goal.status, newStatus);
  }

  db.update(goals)
    .set({ status: newStatus, updated_at: sql`datetime('now')` })
    .where(eq(goals.id, id))
    .run();

  return getById(db, id);
}

export function enrich(
  db: DrizzleDatabase,
  id: number,
  fields: Record<string, string | number | null>,
): Goal {
  enrichEntity(db, goals, 'goals', id, fields);
  return getById(db, id);
}

export function addStarNarrative(
  db: DrizzleDatabase,
  goalId: number,
  narrative: StarNarrativeInput,
): StarNarrative {
  getById(db, goalId);

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
}

export function getStarNarratives(db: DrizzleDatabase, goalId: number): readonly StarNarrative[] {
  getById(db, goalId);

  const rows = db
    .select()
    .from(goalStarNarratives)
    .where(eq(goalStarNarratives.goal_id, goalId))
    .orderBy(desc(goalStarNarratives.created_at))
    .all();

  return rows.map(toStarNarrative);
}

export function getQuarterlyReviewData(
  db: DrizzleDatabase,
  quarter: Quarter,
  year: number,
): QuarterlyReviewData {
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
}

export function saveQuarterlyReview(
  db: DrizzleDatabase,
  review: QuarterlyReviewInput,
): QuarterlyReview {
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
}
