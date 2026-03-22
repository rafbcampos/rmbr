import { describe, it, expect } from 'bun:test';
import { isEnrichmentStatus, parseEnrichmentStatus } from '../../src/shared/type-guards.ts';
import { EnrichmentStatus } from '../../src/core/types.ts';

describe('isEnrichmentStatus', () => {
  it('returns true for raw', () => {
    expect(isEnrichmentStatus(EnrichmentStatus.Raw)).toBe(true);
  });

  it('returns true for enriched', () => {
    expect(isEnrichmentStatus(EnrichmentStatus.Enriched)).toBe(true);
  });

  it('returns false for an invalid value', () => {
    expect(isEnrichmentStatus('pending')).toBe(false);
    expect(isEnrichmentStatus('')).toBe(false);
    expect(isEnrichmentStatus('RAW')).toBe(false);
  });
});

describe('parseEnrichmentStatus', () => {
  it('returns Raw for the raw string', () => {
    expect(parseEnrichmentStatus(EnrichmentStatus.Raw)).toBe(EnrichmentStatus.Raw);
  });

  it('returns Enriched for the enriched string', () => {
    expect(parseEnrichmentStatus(EnrichmentStatus.Enriched)).toBe(EnrichmentStatus.Enriched);
  });

  it('returns Raw for an invalid value', () => {
    expect(parseEnrichmentStatus('unknown')).toBe(EnrichmentStatus.Raw);
    expect(parseEnrichmentStatus('')).toBe(EnrichmentStatus.Raw);
    expect(parseEnrichmentStatus('ENRICHED')).toBe(EnrichmentStatus.Raw);
  });
});
