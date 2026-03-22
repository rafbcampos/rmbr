import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertTil } from '../../helpers/fixtures.ts';
import { tilMigrations } from '../../../src/modules/til/schema.ts';
import { tilTools } from '../../../src/modules/til/tools.ts';
import { EnrichmentStatus } from '../../../src/core/types.ts';
import type { McpToolDefinition, ToolResult } from '../../../src/core/module-contract.ts';

function findTool(name: string): McpToolDefinition {
  const tool = tilTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

describe('TIL tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(tilMigrations);
  });

  describe('rmbr_til_create', () => {
    const tool = findTool('rmbr_til_create');

    it('creates a raw TIL entry', async () => {
      const result = await tool.handler(db, { raw_input: 'Learned about closures' });
      expect(result.id).toBe(1);
      expect(result.raw_input).toBe('Learned about closures');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(result.title).toBeNull();
      expect(result.content).toBeNull();
      expect(result.domain).toBeNull();
      expect(result.tags).toBe('[]');
    });

    it('creates a fully enriched TIL in one step', async () => {
      const result = await tool.handler(db, {
        raw_input: 'Closures capture variables',
        title: 'JavaScript Closures',
        content: 'Closures capture variables from their enclosing scope',
        domain: 'javascript',
        tags: '["closures", "scope"]',
      });
      expect(result.id).toBe(1);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.title).toBe('JavaScript Closures');
      expect(result.content).toBe('Closures capture variables from their enclosing scope');
      expect(result.domain).toBe('javascript');
      expect(result.tags).toBe('["closures", "scope"]');
    });

    it('creates with partial enrichment fields', async () => {
      const result = await tool.handler(db, {
        raw_input: 'Partial enrichment',
        title: 'Just a title',
      });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.title).toBe('Just a title');
      expect(result.content).toBeNull();
      expect(result.domain).toBeNull();
    });
  });

  describe('rmbr_til_list', () => {
    const tool = findTool('rmbr_til_list');

    it('lists all TIL entries', async () => {
      insertTil(db, { raw_input: 'First' });
      insertTil(db, { raw_input: 'Second' });

      const result = await tool.handler(db, {});
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
    });

    it('filters by domain', async () => {
      insertTil(db, { raw_input: 'TS tip', domain: 'typescript' });
      insertTil(db, { raw_input: 'Go tip', domain: 'go' });
      insertTil(db, { raw_input: 'Another TS', domain: 'typescript' });

      const result = await tool.handler(db, { domain: 'typescript' });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('paginates results', async () => {
      for (let i = 0; i < 25; i++) {
        insertTil(db, { raw_input: `TIL ${i}` });
      }

      const page1 = await tool.handler(db, { page: 1 });
      expect(page1.data).toHaveLength(20);
      expect(page1.totalPages).toBe(2);

      const page2 = await tool.handler(db, { page: 2 });
      expect(page2.data).toHaveLength(5);
    });

    it('returns empty result when no entries exist', async () => {
      const result = await tool.handler(db, {});
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('rmbr_til_get', () => {
    const tool = findTool('rmbr_til_get');

    it('retrieves a TIL by id', async () => {
      const id = insertTil(db, { raw_input: 'Get me', domain: 'rust' });
      const result = await tool.handler(db, { id });
      expect(result.id).toBe(id);
      expect(result.raw_input).toBe('Get me');
      expect(result.domain).toBe('rust');
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999 })).rejects.toThrow();
    });
  });

  describe('rmbr_til_search', () => {
    const tool = findTool('rmbr_til_search');

    it('returns matching TIL entries', async () => {
      const createTool = findTool('rmbr_til_create');
      await createTool.handler(db, {
        raw_input: 'raw input',
        title: 'TypeScript generics',
        content: 'Generics enable type-safe polymorphism',
        domain: 'typescript',
      });
      insertTil(db, { raw_input: 'unrelated stuff' });

      const result = await tool.handler(db, { query: 'generics' });
      const data = result.data as ToolResult[];
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty data for no matches', async () => {
      insertTil(db, { raw_input: 'something' });
      const result = await tool.handler(db, { query: 'nonexistent' });
      expect(result.data).toHaveLength(0);
    });
  });

  describe('rmbr_til_domains', () => {
    const tool = findTool('rmbr_til_domains');

    it('returns comma-separated domain list', async () => {
      insertTil(db, { raw_input: 'a', domain: 'rust' });
      insertTil(db, { raw_input: 'b', domain: 'typescript' });
      insertTil(db, { raw_input: 'c', domain: 'rust' });

      const result = await tool.handler(db, {});
      const domains = (result.data as string).split(',');
      expect(domains).toContain('rust');
      expect(domains).toContain('typescript');
      expect(domains).toHaveLength(2);
    });
  });

  describe('rmbr_til_enrich', () => {
    const tool = findTool('rmbr_til_enrich');

    it('enriches a TIL with all fields', async () => {
      const id = insertTil(db, { raw_input: 'Raw input' });
      const result = await tool.handler(db, {
        id,
        title: 'Enriched Title',
        content: 'Enriched content body',
        domain: 'testing',
        tags: '["test", "enrichment"]',
      });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.title).toBe('Enriched Title');
      expect(result.content).toBe('Enriched content body');
      expect(result.domain).toBe('testing');
      expect(result.tags).toBe('["test", "enrichment"]');
    });

    it('enriches with partial fields', async () => {
      const id = insertTil(db, { raw_input: 'Raw input' });
      const result = await tool.handler(db, { id, domain: 'go' });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.domain).toBe('go');
      expect(result.title).toBeNull();
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999, title: 'Nope' })).rejects.toThrow();
    });
  });
});
