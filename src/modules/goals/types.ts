import type { BaseEntity, ToolSerializable } from '../../core/types.ts';
import { GoalStatus, Quarter } from '../../core/types.ts';
import { parseEnrichmentStatus } from '../../shared/type-guards.ts';

export interface Goal extends BaseEntity {
  readonly title: string | null;
  readonly status: GoalStatus;
  readonly quarter: Quarter | null;
  readonly year: number | null;
  readonly kpis: string;
}

export interface StarNarrative extends ToolSerializable {
  readonly id: number;
  readonly goal_id: number;
  readonly situation: string;
  readonly task: string;
  readonly action: string;
  readonly result: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface QuarterlyReview extends ToolSerializable {
  readonly id: number;
  readonly quarter: Quarter;
  readonly year: number;
  readonly what_went_well: string;
  readonly improvements: string;
  readonly kpi_summary: string;
  readonly generated_narrative: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface GoalRow {
  id: number;
  raw_input: string;
  title: string | null;
  status: string;
  quarter: string | null;
  year: number | null;
  kpis: string;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StarNarrativeRow {
  id: number;
  goal_id: number;
  situation: string;
  task: string;
  action: string;
  result: string;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyReviewRow {
  id: number;
  quarter: string;
  year: number;
  what_went_well: string;
  improvements: string;
  kpi_summary: string;
  generated_narrative: string;
  created_at: string;
  updated_at: string;
}

const GOAL_STATUSES = new Set<string>(Object.values(GoalStatus));
const QUARTER_VALUES = new Set<string>(Object.values(Quarter));

export function isGoalStatus(value: string): value is GoalStatus {
  return GOAL_STATUSES.has(value);
}

export function isQuarter(value: string): value is Quarter {
  return QUARTER_VALUES.has(value);
}

function parseGoalStatus(value: string): GoalStatus {
  if (isGoalStatus(value)) return value;
  return GoalStatus.Draft;
}

function parseQuarter(value: string | null): Quarter | null {
  if (value === null) return null;
  if (isQuarter(value)) return value;
  return null;
}

export function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    raw_input: row.raw_input,
    title: row.title,
    status: parseGoalStatus(row.status),
    quarter: parseQuarter(row.quarter),
    year: row.year,
    kpis: row.kpis,
    enrichment_status: parseEnrichmentStatus(row.enrichment_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export function toStarNarrative(row: StarNarrativeRow): StarNarrative {
  return {
    id: row.id,
    goal_id: row.goal_id,
    situation: row.situation,
    task: row.task,
    action: row.action,
    result: row.result,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toQuarterlyReview(row: QuarterlyReviewRow): QuarterlyReview {
  const quarter = isQuarter(row.quarter) ? row.quarter : Quarter.Q1;
  return {
    id: row.id,
    quarter,
    year: row.year,
    what_went_well: row.what_went_well,
    improvements: row.improvements,
    kpi_summary: row.kpi_summary,
    generated_narrative: row.generated_narrative,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
