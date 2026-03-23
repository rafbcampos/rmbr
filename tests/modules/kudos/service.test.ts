import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertKudos } from '../../helpers/fixtures.ts';
import { kudosMigrations } from '../../../src/modules/kudos/schema.ts';
import { KudosService } from '../../../src/modules/kudos/service.ts';
import { NotFoundError } from '../../../src/core/errors.ts';
import { EnrichmentStatus, KudosDirection } from '../../../src/core/types.ts';

describe('KudosService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(kudosMigrations);
  });

  describe('create', () => {
    it('creates a kudos with raw input', () => {
      const kudos = KudosService.create(db, 'Great work on the demo');
      expect(kudos.id).toBe(1);
      expect(kudos.raw_input).toBe('Great work on the demo');
      expect(kudos.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(kudos.direction).toBeNull();
      expect(kudos.person).toBeNull();
      expect(kudos.summary).toBeNull();
      expect(kudos.context).toBeNull();
      expect(kudos.goal_id).toBeNull();
      expect(kudos.created_at).toBeDefined();
      expect(kudos.updated_at).toBeDefined();
    });

    it('auto-increments ids', () => {
      const first = KudosService.create(db, 'First kudos');
      const second = KudosService.create(db, 'Second kudos');
      expect(second.id).toBe(first.id + 1);
    });
  });

  describe('getById', () => {
    it('returns a kudos by id', () => {
      const created = KudosService.create(db, 'Test kudos');
      const fetched = KudosService.getById(db, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.raw_input).toBe('Test kudos');
    });

    it('throws NotFoundError for non-existent id', () => {
      expect(() => KudosService.getById(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('returns empty paginated result when no kudos exist', () => {
      const result = KudosService.list(db);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('returns all kudos ordered by created_at desc', () => {
      insertKudos(db, { raw_input: 'First' });
      insertKudos(db, { raw_input: 'Second' });
      insertKudos(db, { raw_input: 'Third' });

      const result = KudosService.list(db);
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('filters by direction', () => {
      insertKudos(db, { raw_input: 'Given kudos', direction: 'given' });
      insertKudos(db, { raw_input: 'Received kudos', direction: 'received' });
      insertKudos(db, { raw_input: 'Another given', direction: 'given' });

      const given = KudosService.list(db, { direction: KudosDirection.Given });
      expect(given.data).toHaveLength(2);
      expect(given.total).toBe(2);

      const received = KudosService.list(db, { direction: KudosDirection.Received });
      expect(received.data).toHaveLength(1);
      expect(received.total).toBe(1);
    });

    it('filters by person', () => {
      insertKudos(db, { raw_input: 'Kudos for Alice', person: 'Alice' });
      insertKudos(db, { raw_input: 'Kudos for Bob', person: 'Bob' });
      insertKudos(db, { raw_input: 'More for Alice', person: 'Alice' });

      const result = KudosService.list(db, { person: 'Alice' });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by goalId', () => {
      insertKudos(db, { raw_input: 'Goal 1 kudos', goal_id: 1 });
      insertKudos(db, { raw_input: 'Goal 2 kudos', goal_id: 2 });
      insertKudos(db, { raw_input: 'No goal kudos' });

      const result = KudosService.list(db, { goalId: 1 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('combines multiple filters', () => {
      insertKudos(db, { raw_input: 'Match', direction: 'given', person: 'Alice' });
      insertKudos(db, { raw_input: 'No match dir', direction: 'received', person: 'Alice' });
      insertKudos(db, { raw_input: 'No match person', direction: 'given', person: 'Bob' });

      const result = KudosService.list(db, {
        direction: KudosDirection.Given,
        person: 'Alice',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.raw_input).toBe('Match');
    });

    it('paginates results', () => {
      for (let i = 0; i < 5; i++) {
        insertKudos(db, { raw_input: `Kudos ${i}` });
      }

      const page1 = KudosService.list(db, {}, { page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);

      const page2 = KudosService.list(db, {}, { page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(2);

      const page3 = KudosService.list(db, {}, { page: 3, pageSize: 2 });
      expect(page3.data).toHaveLength(1);
    });
  });

  describe('enrich', () => {
    it('enriches a kudos with all fields', () => {
      const created = KudosService.create(db, 'Raw kudos input');
      const enriched = KudosService.enrich(db, created.id, {
        direction: KudosDirection.Given,
        person: 'Alice',
        summary: 'Great demo presentation',
        context: 'Q1 review meeting',
        goal_id: 42,
      });

      expect(enriched.direction).toBe(KudosDirection.Given);
      expect(enriched.person).toBe('Alice');
      expect(enriched.summary).toBe('Great demo presentation');
      expect(enriched.context).toBe('Q1 review meeting');
      expect(enriched.goal_id).toBe(42);
      expect(enriched.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with partial fields', () => {
      const created = KudosService.create(db, 'Raw kudos');
      const enriched = KudosService.enrich(db, created.id, {
        person: 'Bob',
      });

      expect(enriched.person).toBe('Bob');
      expect(enriched.direction).toBeNull();
      expect(enriched.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('throws NotFoundError when enriching non-existent kudos', () => {
      expect(() => KudosService.enrich(db, 999, { person: 'Alice' })).toThrow(NotFoundError);
    });

    it('updates the updated_at timestamp', () => {
      const created = KudosService.create(db, 'Test kudos');
      const enriched = KudosService.enrich(db, created.id, { person: 'Alice' });
      expect(enriched.updated_at).toBeDefined();
    });
  });

  describe('soft-delete', () => {
    it('excludes soft-deleted kudos from list by default', () => {
      insertKudos(db, { raw_input: 'Active kudos' });
      const id2 = insertKudos(db, { raw_input: 'Deleted kudos' });
      KudosService.softDeleteEntity(db, id2);

      const result = KudosService.list(db);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('includes soft-deleted kudos when includeDeleted is true', () => {
      insertKudos(db, { raw_input: 'Active kudos' });
      const id2 = insertKudos(db, { raw_input: 'Deleted kudos' });
      KudosService.softDeleteEntity(db, id2);

      const result = KudosService.list(db, { includeDeleted: true });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('soft-delete and restore round-trip', () => {
      const id = insertKudos(db, { raw_input: 'Round-trip kudos' });
      KudosService.softDeleteEntity(db, id);
      expect(KudosService.list(db).total).toBe(0);

      KudosService.restoreEntity(db, id);
      expect(KudosService.list(db).total).toBe(1);
    });
  });
});
