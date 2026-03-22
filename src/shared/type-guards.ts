import { EnrichmentStatus } from '../core/types.ts';

const ENRICHMENT_STATUSES = new Set<string>(Object.values(EnrichmentStatus));

export function isEnrichmentStatus(value: string): value is EnrichmentStatus {
  return ENRICHMENT_STATUSES.has(value);
}

export function parseEnrichmentStatus(value: string): EnrichmentStatus {
  if (isEnrichmentStatus(value)) return value;
  return EnrichmentStatus.Raw;
}
