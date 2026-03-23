import type { BaseEntity } from '../../core/types.ts';
import { StudyStatus } from '../../core/types.ts';
import { parseEnrichmentStatus } from '../../shared/type-guards.ts';
import { ValidationError } from '../../core/errors.ts';

export interface StudyTopic extends BaseEntity {
  readonly title: string | null;
  readonly status: StudyStatus;
  readonly domain: string | null;
  readonly notes: string;
  readonly resources: string;
  readonly goal_id: number | null;
}

export interface StudyTopicRow {
  id: number;
  raw_input: string;
  title: string | null;
  status: string;
  domain: string | null;
  notes: string;
  resources: string;
  goal_id: number | null;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const STUDY_STATUSES = new Set<string>(Object.values(StudyStatus));

export function isStudyStatus(value: string): value is StudyStatus {
  return STUDY_STATUSES.has(value);
}

export function parseStudyStatus(value: string): StudyStatus {
  if (isStudyStatus(value)) {
    return value;
  }
  throw new ValidationError(`Invalid study status: '${value}'`);
}

export function toStudyTopic(row: StudyTopicRow): StudyTopic {
  const status = isStudyStatus(row.status) ? row.status : StudyStatus.Queued;
  const enrichmentStatus = parseEnrichmentStatus(row.enrichment_status);

  return {
    id: row.id,
    raw_input: row.raw_input,
    title: row.title,
    status,
    domain: row.domain,
    notes: row.notes,
    resources: row.resources,
    goal_id: row.goal_id,
    enrichment_status: enrichmentStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}
