import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { studyMigrations } from '../../../src/modules/study/schema.ts';
import { goalsMigrations as goalMigrations } from '../../../src/modules/goals/schema.ts';
import { StudyService } from '../../../src/modules/study/service.ts';
import { NotFoundError, InvalidTransitionError } from '../../../src/core/errors.ts';
import { StudyStatus, EnrichmentStatus } from '../../../src/core/types.ts';
import { insertStudyTopic, insertGoal } from '../../helpers/fixtures.ts';
import { parseJsonStringArray } from '../../helpers/tool-result.ts';

describe('StudyService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalMigrations, ...studyMigrations]);
  });

  describe('create', () => {
    it('creates a study topic with raw input', () => {
      const topic = StudyService.create(db, 'Learn Rust ownership');
      expect(topic.id).toBe(1);
      expect(topic.raw_input).toBe('Learn Rust ownership');
      expect(topic.status).toBe(StudyStatus.Queued);
      expect(topic.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(topic.title).toBeNull();
      expect(topic.domain).toBeNull();
      expect(topic.notes).toBe('[]');
      expect(topic.resources).toBe('[]');
      expect(topic.goal_id).toBeNull();
    });

    it('creates multiple study topics with incrementing ids', () => {
      const t1 = StudyService.create(db, 'First');
      const t2 = StudyService.create(db, 'Second');
      expect(t1.id).toBe(1);
      expect(t2.id).toBe(2);
    });
  });

  describe('getById', () => {
    it('returns a study topic by id', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      const topic = StudyService.getById(db, id);
      expect(topic.id).toBe(id);
      expect(topic.raw_input).toBe('Test topic');
    });

    it('throws NotFoundError for missing study topic', () => {
      expect(() => StudyService.getById(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('lists all study topics', () => {
      insertStudyTopic(db, { raw_input: 'Topic 1' });
      insertStudyTopic(db, { raw_input: 'Topic 2' });
      insertStudyTopic(db, { raw_input: 'Topic 3' });

      const result = StudyService.list(db);
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by status', () => {
      insertStudyTopic(db, { raw_input: 'Queued topic', status: 'queued' });
      insertStudyTopic(db, { raw_input: 'In progress topic', status: 'in_progress' });
      insertStudyTopic(db, { raw_input: 'Completed topic', status: 'completed' });

      const result = StudyService.list(db, { status: StudyStatus.Queued });
      expect(result.total).toBe(1);
      expect(result.data[0]?.raw_input).toBe('Queued topic');
    });

    it('filters by domain', () => {
      insertStudyTopic(db, { raw_input: 'Rust topic', domain: 'programming' });
      insertStudyTopic(db, { raw_input: 'Math topic', domain: 'mathematics' });

      const result = StudyService.list(db, { domain: 'programming' });
      expect(result.total).toBe(1);
      expect(result.data[0]?.raw_input).toBe('Rust topic');
    });

    it('filters by goalId', () => {
      const goalId = insertGoal(db, { raw_input: 'Test goal' });
      insertStudyTopic(db, { raw_input: 'With goal', goal_id: goalId });
      insertStudyTopic(db, { raw_input: 'Without goal' });

      const result = StudyService.list(db, { goalId });
      expect(result.total).toBe(1);
      expect(result.data[0]?.raw_input).toBe('With goal');
    });

    it('paginates results', () => {
      for (let i = 0; i < 5; i++) {
        insertStudyTopic(db, { raw_input: `Topic ${i}` });
      }

      const page1 = StudyService.list(db, undefined, { page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);

      const page3 = StudyService.list(db, undefined, { page: 3, pageSize: 2 });
      expect(page3.data).toHaveLength(1);
    });

    it('returns empty result when no study topics exist', () => {
      const result = StudyService.list(db);
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('transition', () => {
    it('transitions queued -> in_progress', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'queued' });
      const topic = StudyService.transition(db, id, StudyStatus.InProgress);
      expect(topic.status).toBe(StudyStatus.InProgress);
    });

    it('transitions in_progress -> completed', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'in_progress' });
      const topic = StudyService.transition(db, id, StudyStatus.Completed);
      expect(topic.status).toBe(StudyStatus.Completed);
    });

    it('transitions in_progress -> parked', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'in_progress' });
      const topic = StudyService.transition(db, id, StudyStatus.Parked);
      expect(topic.status).toBe(StudyStatus.Parked);
    });

    it('transitions parked -> in_progress', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'parked' });
      const topic = StudyService.transition(db, id, StudyStatus.InProgress);
      expect(topic.status).toBe(StudyStatus.InProgress);
    });

    it('rejects transition from completed', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'completed' });
      expect(() => StudyService.transition(db, id, StudyStatus.InProgress)).toThrow(
        InvalidTransitionError,
      );
    });

    it('rejects invalid transition queued -> completed', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'queued' });
      expect(() => StudyService.transition(db, id, StudyStatus.Completed)).toThrow(
        InvalidTransitionError,
      );
    });

    it('rejects invalid transition queued -> parked', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: 'queued' });
      expect(() => StudyService.transition(db, id, StudyStatus.Parked)).toThrow(
        InvalidTransitionError,
      );
    });

    it('throws NotFoundError for missing study topic', () => {
      expect(() => StudyService.transition(db, 999, StudyStatus.InProgress)).toThrow(NotFoundError);
    });
  });

  describe('addNote', () => {
    it('adds a note to a study topic', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      const topic = StudyService.addNote(db, id, 'First note');
      const notes = parseJsonStringArray(topic.notes);
      expect(notes).toEqual(['First note']);
    });

    it('appends multiple notes', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      StudyService.addNote(db, id, 'First note');
      const topic = StudyService.addNote(db, id, 'Second note');
      const notes = parseJsonStringArray(topic.notes);
      expect(notes).toEqual(['First note', 'Second note']);
    });

    it('throws NotFoundError for missing study topic', () => {
      expect(() => StudyService.addNote(db, 999, 'note')).toThrow(NotFoundError);
    });
  });

  describe('addResource', () => {
    it('adds a resource to a study topic', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      const topic = StudyService.addResource(db, id, 'https://example.com');
      const resources = parseJsonStringArray(topic.resources);
      expect(resources).toEqual(['https://example.com']);
    });

    it('appends multiple resources', () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      StudyService.addResource(db, id, 'https://example.com');
      const topic = StudyService.addResource(db, id, 'https://docs.example.com');
      const resources = parseJsonStringArray(topic.resources);
      expect(resources).toEqual(['https://example.com', 'https://docs.example.com']);
    });

    it('throws NotFoundError for missing study topic', () => {
      expect(() => StudyService.addResource(db, 999, 'https://example.com')).toThrow(NotFoundError);
    });
  });

  describe('getNext', () => {
    it('returns the oldest queued study topic', () => {
      insertStudyTopic(db, { raw_input: 'First queued' });
      insertStudyTopic(db, { raw_input: 'Second queued' });

      const next = StudyService.getNext(db);
      expect(next).not.toBeNull();
      expect(next?.raw_input).toBe('First queued');
    });

    it('skips non-queued topics', () => {
      insertStudyTopic(db, { raw_input: 'In progress', status: 'in_progress' });
      insertStudyTopic(db, { raw_input: 'Queued one', status: 'queued' });

      const next = StudyService.getNext(db);
      expect(next).not.toBeNull();
      expect(next?.raw_input).toBe('Queued one');
    });

    it('returns null when no queued topics exist', () => {
      insertStudyTopic(db, { raw_input: 'Completed', status: 'completed' });

      const next = StudyService.getNext(db);
      expect(next).toBeNull();
    });

    it('returns null when no topics exist', () => {
      const next = StudyService.getNext(db);
      expect(next).toBeNull();
    });
  });

  describe('enrich', () => {
    it('enriches a study topic with title', () => {
      const id = insertStudyTopic(db, { raw_input: 'Learn stuff' });
      const topic = StudyService.enrich(db, id, { title: 'Learn Rust ownership model' });
      expect(topic.title).toBe('Learn Rust ownership model');
      expect(topic.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with all fields', () => {
      const goalId = insertGoal(db, { raw_input: 'Career goal' });
      const id = insertStudyTopic(db, { raw_input: 'Study topic' });
      const topic = StudyService.enrich(db, id, {
        title: 'Advanced TypeScript',
        domain: 'programming',
        goal_id: goalId,
      });
      expect(topic.title).toBe('Advanced TypeScript');
      expect(topic.domain).toBe('programming');
      expect(topic.goal_id).toBe(goalId);
      expect(topic.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('throws NotFoundError for missing study topic', () => {
      expect(() => StudyService.enrich(db, 999, { title: 'Nope' })).toThrow(NotFoundError);
    });
  });

  describe('soft-delete', () => {
    it('excludes soft-deleted study topics from list by default', () => {
      insertStudyTopic(db, { raw_input: 'Active topic' });
      const id2 = insertStudyTopic(db, { raw_input: 'Deleted topic' });
      StudyService.softDeleteEntity(db, id2);

      const result = StudyService.list(db);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('includes soft-deleted study topics when includeDeleted is true', () => {
      insertStudyTopic(db, { raw_input: 'Active topic' });
      const id2 = insertStudyTopic(db, { raw_input: 'Deleted topic' });
      StudyService.softDeleteEntity(db, id2);

      const result = StudyService.list(db, { includeDeleted: true });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('soft-delete and restore round-trip', () => {
      const id = insertStudyTopic(db, { raw_input: 'Round-trip topic' });
      StudyService.softDeleteEntity(db, id);
      expect(StudyService.list(db).total).toBe(0);

      StudyService.restoreEntity(db, id);
      expect(StudyService.list(db).total).toBe(1);
    });
  });
});
