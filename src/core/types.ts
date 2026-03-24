declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TodoId = Brand<number, 'TodoId'>;
export type GoalId = Brand<number, 'GoalId'>;
export type KudosId = Brand<number, 'KudosId'>;
export type TilId = Brand<number, 'TilId'>;
export type StudyTopicId = Brand<number, 'StudyTopicId'>;
export type SlackMessageId = Brand<number, 'SlackMessageId'>;
export type QuarterlyReviewId = Brand<number, 'QuarterlyReviewId'>;
export type StarNarrativeId = Brand<number, 'StarNarrativeId'>;

export const TodoStatus = {
  Sketch: 'sketch',
  Ready: 'ready',
  InProgress: 'in_progress',
  Paused: 'paused',
  Done: 'done',
  Cancelled: 'cancelled',
} as const;
export type TodoStatus = (typeof TodoStatus)[keyof typeof TodoStatus];

export const GoalStatus = {
  Draft: 'draft',
  Active: 'active',
  Completed: 'completed',
  Abandoned: 'abandoned',
} as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const StudyStatus = {
  Queued: 'queued',
  InProgress: 'in_progress',
  Completed: 'completed',
  Parked: 'parked',
} as const;
export type StudyStatus = (typeof StudyStatus)[keyof typeof StudyStatus];

export const EnrichmentStatus = {
  Raw: 'raw',
  Enriched: 'enriched',
} as const;
export type EnrichmentStatus = (typeof EnrichmentStatus)[keyof typeof EnrichmentStatus];

export const SlackSentiment = {
  Positive: 'positive',
  Negative: 'negative',
  Neutral: 'neutral',
} as const;
export type SlackSentiment = (typeof SlackSentiment)[keyof typeof SlackSentiment];

export const Quarter = {
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
} as const;
export type Quarter = (typeof Quarter)[keyof typeof Quarter];

export const TodoPriority = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;
export type TodoPriority = (typeof TodoPriority)[keyof typeof TodoPriority];

export const KudosDirection = {
  Given: 'given',
  Received: 'received',
} as const;
export type KudosDirection = (typeof KudosDirection)[keyof typeof KudosDirection];

export interface ToolSerializable {
  readonly [key: string]: string | number | boolean | null;
}

export interface BaseEntity extends ToolSerializable {
  readonly id: number;
  readonly raw_input: string;
  readonly enrichment_status: EnrichmentStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface DateRange {
  readonly start: string;
  readonly end: string;
}
