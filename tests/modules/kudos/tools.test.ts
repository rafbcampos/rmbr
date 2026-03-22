import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { kudosMigrations } from '../../../src/modules/kudos/schema.ts';
import { goalsMigrations as goalMigrations } from '../../../src/modules/goals/schema.ts';
import { kudosTools } from '../../../src/modules/kudos/tools.ts';
import { KudosDirection, EnrichmentStatus } from '../../../src/core/types.ts';
import { insertKudos, insertGoal } from '../../helpers/fixtures.ts';

const findTool = (name: string) => {
  const tool = kudosTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
};

describe('kudos tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalMigrations, ...kudosMigrations]);
  });

  describe('rmbr_kudos_create', () => {
    it('creates a raw kudos entry without enrichment fields', async () => {
      const tool = findTool('rmbr_kudos_create');
      const result = await tool.handler(db, { raw_input: 'Alice helped with deployment' });

      expect(result.raw_input).toBe('Alice helped with deployment');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(result.direction).toBeNull();
      expect(result.person).toBeNull();
      expect(result.summary).toBeNull();
      expect(result.context).toBeNull();
      expect(result.goal_id).toBeNull();
    });

    it('creates a kudos entry with enrichment fields', async () => {
      const goalId = insertGoal(db, { raw_input: 'Team collaboration' });
      const tool = findTool('rmbr_kudos_create');
      const result = await tool.handler(db, {
        raw_input: 'Alice helped with deployment',
        direction: KudosDirection.Received,
        person: 'Alice',
        summary: 'Helped deploy the new service',
        context: 'Production deployment of auth service',
        goal_id: goalId,
      });

      expect(result.raw_input).toBe('Alice helped with deployment');
      expect(result.direction).toBe(KudosDirection.Received);
      expect(result.person).toBe('Alice');
      expect(result.summary).toBe('Helped deploy the new service');
      expect(result.context).toBe('Production deployment of auth service');
      expect(result.goal_id).toBe(goalId);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('creates with partial enrichment fields', async () => {
      const tool = findTool('rmbr_kudos_create');
      const result = await tool.handler(db, {
        raw_input: 'Thanked Bob for review',
        direction: KudosDirection.Given,
        person: 'Bob',
      });

      expect(result.direction).toBe(KudosDirection.Given);
      expect(result.person).toBe('Bob');
      expect(result.summary).toBeNull();
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });
  });

  describe('rmbr_kudos_list', () => {
    it('lists all kudos entries', async () => {
      insertKudos(db, { raw_input: 'Kudos 1' });
      insertKudos(db, { raw_input: 'Kudos 2' });
      insertKudos(db, { raw_input: 'Kudos 3' });

      const tool = findTool('rmbr_kudos_list');
      const result = await tool.handler(db, {});

      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect((result.data as unknown[]).length).toBe(3);
    });

    it('filters by direction', async () => {
      insertKudos(db, { raw_input: 'Given one', direction: KudosDirection.Given });
      insertKudos(db, { raw_input: 'Received one', direction: KudosDirection.Received });
      insertKudos(db, { raw_input: 'Another given', direction: KudosDirection.Given });

      const tool = findTool('rmbr_kudos_list');
      const result = await tool.handler(db, { direction: KudosDirection.Received });

      expect(result.total).toBe(1);
      const data = result.data as Array<Record<string, unknown>>;
      expect(data[0]?.raw_input).toBe('Received one');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 25; i++) {
        insertKudos(db, { raw_input: `Kudos ${i}` });
      }

      const tool = findTool('rmbr_kudos_list');
      const page1 = await tool.handler(db, { page: 1 });

      expect(page1.total).toBe(25);
      expect((page1.data as unknown[]).length).toBe(20);
      expect(page1.pageSize).toBe(20);
      expect(page1.totalPages).toBe(2);

      const page2 = await tool.handler(db, { page: 2 });
      expect((page2.data as unknown[]).length).toBe(5);
    });

    it('returns empty result when no kudos exist', async () => {
      const tool = findTool('rmbr_kudos_list');
      const result = await tool.handler(db, {});

      expect(result.total).toBe(0);
      expect((result.data as unknown[]).length).toBe(0);
    });
  });

  describe('rmbr_kudos_get', () => {
    it('returns a kudos entry by id', async () => {
      const id = insertKudos(db, { raw_input: 'Test kudos' });

      const tool = findTool('rmbr_kudos_get');
      const result = await tool.handler(db, { id });

      expect(result.id).toBe(id);
      expect(result.raw_input).toBe('Test kudos');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
    });

    it('returns all expected fields', async () => {
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      const id = insertKudos(db, {
        raw_input: 'Full kudos',
        direction: KudosDirection.Given,
        person: 'Charlie',
        summary: 'Great code review',
        context: 'Sprint 42',
        goal_id: goalId,
      });

      const tool = findTool('rmbr_kudos_get');
      const result = await tool.handler(db, { id });

      expect(result.id).toBe(id);
      expect(result.raw_input).toBe('Full kudos');
      expect(result.direction).toBe(KudosDirection.Given);
      expect(result.person).toBe('Charlie');
      expect(result.summary).toBe('Great code review');
      expect(result.context).toBe('Sprint 42');
      expect(result.goal_id).toBe(goalId);
      expect(result.created_at).toBeString();
      expect(result.updated_at).toBeString();
    });

    it('throws for non-existent id', async () => {
      const tool = findTool('rmbr_kudos_get');
      await expect(tool.handler(db, { id: 999 })).rejects.toThrow();
    });
  });

  describe('rmbr_kudos_enrich', () => {
    it('enriches a kudos entry with structured fields', async () => {
      const id = insertKudos(db, { raw_input: 'Raw kudos' });

      const tool = findTool('rmbr_kudos_enrich');
      const result = await tool.handler(db, {
        id,
        direction: KudosDirection.Received,
        person: 'Diana',
        summary: 'Mentored on architecture',
        context: 'System design review',
      });

      expect(result.direction).toBe(KudosDirection.Received);
      expect(result.person).toBe('Diana');
      expect(result.summary).toBe('Mentored on architecture');
      expect(result.context).toBe('System design review');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with goal_id', async () => {
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      const id = insertKudos(db, { raw_input: 'Link to goal' });

      const tool = findTool('rmbr_kudos_enrich');
      const result = await tool.handler(db, { id, goal_id: goalId });

      expect(result.goal_id).toBe(goalId);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with partial fields', async () => {
      const id = insertKudos(db, { raw_input: 'Partial enrich' });

      const tool = findTool('rmbr_kudos_enrich');
      const result = await tool.handler(db, {
        id,
        person: 'Eve',
      });

      expect(result.person).toBe('Eve');
      expect(result.direction).toBeNull();
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });
  });
});
