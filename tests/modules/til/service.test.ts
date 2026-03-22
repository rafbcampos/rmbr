import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertTil } from '../../helpers/fixtures.ts';
import { tilMigrations } from '../../../src/modules/til/schema.ts';
import { TilService } from '../../../src/modules/til/service.ts';
import { NotFoundError } from '../../../src/core/errors.ts';
import { EnrichmentStatus } from '../../../src/core/types.ts';

describe('TilService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(tilMigrations);
  });

  describe('create', () => {
    it('creates a til with raw input', () => {
      const til = TilService.create(db, 'Learned about TypeScript branded types');
      expect(til.id).toBe(1);
      expect(til.raw_input).toBe('Learned about TypeScript branded types');
      expect(til.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(til.title).toBeNull();
      expect(til.content).toBeNull();
      expect(til.domain).toBeNull();
      expect(til.tags).toBe('[]');
      expect(til.created_at).toBeDefined();
      expect(til.updated_at).toBeDefined();
    });

    it('auto-increments ids', () => {
      const first = TilService.create(db, 'First TIL');
      const second = TilService.create(db, 'Second TIL');
      expect(second.id).toBe(first.id + 1);
    });
  });

  describe('getById', () => {
    it('returns a til by id', () => {
      const created = TilService.create(db, 'Test TIL');
      const fetched = TilService.getById(db, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.raw_input).toBe('Test TIL');
    });

    it('throws NotFoundError for non-existent id', () => {
      expect(() => TilService.getById(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('returns empty paginated result when no tils exist', () => {
      const result = TilService.list(db);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('returns all tils ordered by created_at desc', () => {
      insertTil(db, { raw_input: 'First' });
      insertTil(db, { raw_input: 'Second' });
      insertTil(db, { raw_input: 'Third' });

      const result = TilService.list(db);
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('filters by domain', () => {
      insertTil(db, { raw_input: 'TS thing', domain: 'typescript' });
      insertTil(db, { raw_input: 'Rust thing', domain: 'rust' });
      insertTil(db, { raw_input: 'Another TS', domain: 'typescript' });

      const tsResult = TilService.list(db, { domain: 'typescript' });
      expect(tsResult.data).toHaveLength(2);
      expect(tsResult.total).toBe(2);

      const rustResult = TilService.list(db, { domain: 'rust' });
      expect(rustResult.data).toHaveLength(1);
      expect(rustResult.total).toBe(1);
    });

    it('paginates results', () => {
      for (let i = 0; i < 5; i++) {
        insertTil(db, { raw_input: `TIL ${i}` });
      }

      const page1 = TilService.list(db, {}, { page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);

      const page2 = TilService.list(db, {}, { page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(2);

      const page3 = TilService.list(db, {}, { page: 3, pageSize: 2 });
      expect(page3.data).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('returns matching tils via full-text search', () => {
      const til = TilService.create(db, 'raw input');
      TilService.enrich(db, til.id, {
        title: 'TypeScript branded types',
        content: 'You can use branded types for nominal typing',
        domain: 'typescript',
      });

      insertTil(db, { raw_input: 'unrelated' });

      const results = TilService.search(db, 'branded');
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('TypeScript branded types');
    });

    it('returns empty array when no matches found', () => {
      insertTil(db, { raw_input: 'something' });
      const results = TilService.search(db, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('searches across title, content, and domain', () => {
      const til1 = TilService.create(db, 'raw1');
      TilService.enrich(db, til1.id, { title: 'Generics in Go' });

      const til2 = TilService.create(db, 'raw2');
      TilService.enrich(db, til2.id, { content: 'Go supports generics since 1.18' });

      const til3 = TilService.create(db, 'raw3');
      TilService.enrich(db, til3.id, { domain: 'golang' });

      const titleResults = TilService.search(db, 'Generics');
      expect(titleResults.length).toBeGreaterThanOrEqual(1);

      const domainResults = TilService.search(db, 'golang');
      expect(domainResults).toHaveLength(1);
    });
  });

  describe('getDomains', () => {
    it('returns empty array when no tils exist', () => {
      const domains = TilService.getDomains(db);
      expect(domains).toHaveLength(0);
    });

    it('returns distinct domains sorted alphabetically', () => {
      insertTil(db, { raw_input: 'a', domain: 'rust' });
      insertTil(db, { raw_input: 'b', domain: 'typescript' });
      insertTil(db, { raw_input: 'c', domain: 'rust' });
      insertTil(db, { raw_input: 'd', domain: 'go' });

      const domains = TilService.getDomains(db);
      expect(domains).toHaveLength(3);
      expect(domains[0]).toBe('go');
      expect(domains[1]).toBe('rust');
      expect(domains[2]).toBe('typescript');
    });

    it('excludes null domains', () => {
      insertTil(db, { raw_input: 'a', domain: 'rust' });
      insertTil(db, { raw_input: 'b' });

      const domains = TilService.getDomains(db);
      expect(domains).toHaveLength(1);
      expect(domains[0]).toBe('rust');
    });
  });

  describe('enrich', () => {
    it('enriches a til with all fields', () => {
      const created = TilService.create(db, 'Raw TIL input');
      const enriched = TilService.enrich(db, created.id, {
        title: 'Branded Types',
        content: 'TypeScript branded types for nominal typing',
        domain: 'typescript',
        tags: '["types", "typescript"]',
      });

      expect(enriched.title).toBe('Branded Types');
      expect(enriched.content).toBe('TypeScript branded types for nominal typing');
      expect(enriched.domain).toBe('typescript');
      expect(enriched.tags).toBe('["types", "typescript"]');
      expect(enriched.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with partial fields', () => {
      const created = TilService.create(db, 'Raw TIL');
      const enriched = TilService.enrich(db, created.id, {
        domain: 'rust',
      });

      expect(enriched.domain).toBe('rust');
      expect(enriched.title).toBeNull();
      expect(enriched.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('throws NotFoundError when enriching non-existent til', () => {
      expect(() => TilService.enrich(db, 999, { title: 'Test' })).toThrow(NotFoundError);
    });

    it('updates the updated_at timestamp', () => {
      const created = TilService.create(db, 'Test TIL');
      const enriched = TilService.enrich(db, created.id, { title: 'Updated' });
      expect(enriched.updated_at).toBeDefined();
    });
  });
});
