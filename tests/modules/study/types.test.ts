import { describe, it, expect } from 'bun:test';
import { StudyStatus, EnrichmentStatus } from '../../../src/core/types.ts';
import { ValidationError } from '../../../src/core/errors.ts';
import { isStudyStatus, parseStudyStatus, toStudyTopic } from '../../../src/modules/study/types.ts';
import type { StudyTopicRow } from '../../../src/modules/study/types.ts';

function makeStudyTopicRow(overrides: Partial<StudyTopicRow> = {}): StudyTopicRow {
  return {
    id: 1,
    raw_input: 'Test study topic',
    title: null,
    status: StudyStatus.Queued,
    domain: null,
    notes: '[]',
    resources: '[]',
    goal_id: null,
    enrichment_status: EnrichmentStatus.Raw,
    created_at: '2024-01-01 00:00:00',
    updated_at: '2024-01-01 00:00:00',
    ...overrides,
  };
}

describe('isStudyStatus', () => {
  it('returns true for each valid StudyStatus value', () => {
    expect(isStudyStatus(StudyStatus.Queued)).toBe(true);
    expect(isStudyStatus(StudyStatus.InProgress)).toBe(true);
    expect(isStudyStatus(StudyStatus.Completed)).toBe(true);
    expect(isStudyStatus(StudyStatus.Parked)).toBe(true);
  });

  it('returns false for invalid status strings', () => {
    expect(isStudyStatus('invalid')).toBe(false);
    expect(isStudyStatus('')).toBe(false);
    expect(isStudyStatus('QUEUED')).toBe(false);
    expect(isStudyStatus('active')).toBe(false);
  });
});

describe('parseStudyStatus', () => {
  it('returns the status for each valid value', () => {
    expect(parseStudyStatus(StudyStatus.Queued)).toBe(StudyStatus.Queued);
    expect(parseStudyStatus(StudyStatus.InProgress)).toBe(StudyStatus.InProgress);
    expect(parseStudyStatus(StudyStatus.Completed)).toBe(StudyStatus.Completed);
    expect(parseStudyStatus(StudyStatus.Parked)).toBe(StudyStatus.Parked);
  });

  it('throws ValidationError for invalid status', () => {
    expect(() => parseStudyStatus('invalid')).toThrow(ValidationError);
    expect(() => parseStudyStatus('')).toThrow(ValidationError);
    expect(() => parseStudyStatus('COMPLETED')).toThrow(ValidationError);
  });
});

describe('toStudyTopic', () => {
  it('converts a valid row to a StudyTopic entity', () => {
    const row = makeStudyTopicRow({
      id: 42,
      raw_input: 'Learn advanced TypeScript',
      title: 'Advanced TypeScript',
      status: StudyStatus.InProgress,
      domain: 'programming',
      notes: '["note 1"]',
      resources: '["https://example.com"]',
      goal_id: 5,
      enrichment_status: EnrichmentStatus.Enriched,
    });

    const entity = toStudyTopic(row);
    expect(entity.id).toBe(42);
    expect(entity.raw_input).toBe('Learn advanced TypeScript');
    expect(entity.title).toBe('Advanced TypeScript');
    expect(entity.status).toBe(StudyStatus.InProgress);
    expect(entity.domain).toBe('programming');
    expect(entity.notes).toBe('["note 1"]');
    expect(entity.resources).toBe('["https://example.com"]');
    expect(entity.goal_id).toBe(5);
    expect(entity.enrichment_status).toBe(EnrichmentStatus.Enriched);
  });

  it('defaults invalid status to Queued', () => {
    const row = makeStudyTopicRow({ status: 'bogus_status' });
    const entity = toStudyTopic(row);
    expect(entity.status).toBe(StudyStatus.Queued);
  });

  it('preserves null fields', () => {
    const row = makeStudyTopicRow();
    const entity = toStudyTopic(row);
    expect(entity.title).toBeNull();
    expect(entity.domain).toBeNull();
    expect(entity.goal_id).toBeNull();
  });

  it('defaults unknown enrichment_status to Raw', () => {
    const row = makeStudyTopicRow({ enrichment_status: 'unknown_status' });
    const entity = toStudyTopic(row);
    expect(entity.enrichment_status).toBe(EnrichmentStatus.Raw);
  });
});
