import { KudosDirection } from '../../core/types.ts';
import type { BaseEntity } from '../../core/types.ts';
import { parseEnrichmentStatus } from '../../shared/type-guards.ts';

export interface Kudos extends BaseEntity {
  readonly direction: KudosDirection | null;
  readonly person: string | null;
  readonly summary: string | null;
  readonly context: string | null;
  readonly goal_id: number | null;
}

export interface KudosRow {
  id: number;
  raw_input: string;
  direction: string | null;
  person: string | null;
  summary: string | null;
  context: string | null;
  goal_id: number | null;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const KUDOS_DIRECTIONS = new Set<string>(Object.values(KudosDirection));

export function isKudosDirection(value: string): value is KudosDirection {
  return KUDOS_DIRECTIONS.has(value);
}

function parseDirection(value: string | null): KudosDirection | null {
  if (value === null) return null;
  if (isKudosDirection(value)) return value;
  return null;
}

export function toKudos(row: KudosRow): Kudos {
  return {
    id: row.id,
    raw_input: row.raw_input,
    direction: parseDirection(row.direction),
    person: row.person,
    summary: row.summary,
    context: row.context,
    goal_id: row.goal_id,
    enrichment_status: parseEnrichmentStatus(row.enrichment_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}
