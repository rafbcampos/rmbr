import type { BaseEntity } from '../../core/types.ts';
import { parseEnrichmentStatus } from '../../shared/type-guards.ts';

export interface Til extends BaseEntity {
  readonly title: string | null;
  readonly content: string | null;
  readonly domain: string | null;
  readonly tags: string;
}

export interface TilRow {
  id: number;
  raw_input: string;
  title: string | null;
  content: string | null;
  domain: string | null;
  tags: string;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function toTil(row: TilRow): Til {
  return {
    id: row.id,
    raw_input: row.raw_input,
    title: row.title,
    content: row.content,
    domain: row.domain,
    tags: row.tags,
    enrichment_status: parseEnrichmentStatus(row.enrichment_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}
