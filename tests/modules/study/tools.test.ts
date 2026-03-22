import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertStudyTopic, insertGoal } from '../../helpers/fixtures.ts';
import { studyMigrations } from '../../../src/modules/study/schema.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { studyTools } from '../../../src/modules/study/tools.ts';
import { StudyStatus, EnrichmentStatus } from '../../../src/core/types.ts';
import type { McpToolDefinition } from '../../../src/core/module-contract.ts';

function findTool(name: string): McpToolDefinition {
  const tool = studyTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

describe('Study tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalsMigrations, ...studyMigrations]);
  });

  describe('rmbr_study_create', () => {
    const tool = findTool('rmbr_study_create');

    it('creates a raw study topic', async () => {
      const result = await tool.handler(db, { raw_input: 'Learn Rust ownership' });
      expect(result.id).toBe(1);
      expect(result.raw_input).toBe('Learn Rust ownership');
      expect(result.status).toBe(StudyStatus.Queued);
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(result.title).toBeNull();
      expect(result.domain).toBeNull();
      expect(result.notes).toBe('[]');
      expect(result.resources).toBe('[]');
      expect(result.goal_id).toBeNull();
    });

    it('creates with enrichment fields in one step', async () => {
      const goalId = insertGoal(db, { raw_input: 'Career goal' });
      const result = await tool.handler(db, {
        raw_input: 'Study TypeScript advanced types',
        title: 'Advanced TypeScript',
        domain: 'programming',
        goal_id: goalId,
      });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.title).toBe('Advanced TypeScript');
      expect(result.domain).toBe('programming');
      expect(result.goal_id).toBe(goalId);
    });

    it('creates with partial enrichment', async () => {
      const result = await tool.handler(db, {
        raw_input: 'Partial study',
        title: 'Just a title',
      });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.title).toBe('Just a title');
      expect(result.domain).toBeNull();
      expect(result.goal_id).toBeNull();
    });
  });

  describe('rmbr_study_list', () => {
    const tool = findTool('rmbr_study_list');

    it('lists all study topics', async () => {
      insertStudyTopic(db, { raw_input: 'Topic 1' });
      insertStudyTopic(db, { raw_input: 'Topic 2' });
      insertStudyTopic(db, { raw_input: 'Topic 3' });

      const result = await tool.handler(db, {});
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
    });

    it('filters by status', async () => {
      insertStudyTopic(db, { raw_input: 'Queued', status: StudyStatus.Queued });
      insertStudyTopic(db, { raw_input: 'In progress', status: StudyStatus.InProgress });
      insertStudyTopic(db, { raw_input: 'Completed', status: StudyStatus.Completed });

      const result = await tool.handler(db, { status: StudyStatus.Queued });
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        insertStudyTopic(db, { raw_input: `Topic ${i}` });
      }

      const page1 = await tool.handler(db, { page: 1, page_size: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);

      const page3 = await tool.handler(db, { page: 3, page_size: 2 });
      expect(page3.data).toHaveLength(1);
    });

    it('returns empty result when no topics exist', async () => {
      const result = await tool.handler(db, {});
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('rmbr_study_get', () => {
    const tool = findTool('rmbr_study_get');

    it('retrieves a study topic by id', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Get me', domain: 'math' });
      const result = await tool.handler(db, { id });
      expect(result.id).toBe(id);
      expect(result.raw_input).toBe('Get me');
      expect(result.domain).toBe('math');
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999 })).rejects.toThrow();
    });
  });

  describe('rmbr_study_transition', () => {
    const tool = findTool('rmbr_study_transition');

    it('transitions queued to in_progress', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: StudyStatus.Queued });
      const result = await tool.handler(db, { id, status: StudyStatus.InProgress });
      expect(result.status).toBe(StudyStatus.InProgress);
    });

    it('rejects invalid transition', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Test', status: StudyStatus.Queued });
      await expect(tool.handler(db, { id, status: StudyStatus.Completed })).rejects.toThrow();
    });
  });

  describe('rmbr_study_enrich', () => {
    const tool = findTool('rmbr_study_enrich');

    it('enriches a study topic with all fields', async () => {
      const goalId = insertGoal(db, { raw_input: 'Goal' });
      const id = insertStudyTopic(db, { raw_input: 'Study topic' });
      const result = await tool.handler(db, {
        id,
        title: 'Enriched Study',
        domain: 'engineering',
        goal_id: goalId,
      });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.title).toBe('Enriched Study');
      expect(result.domain).toBe('engineering');
      expect(result.goal_id).toBe(goalId);
    });

    it('enriches with partial fields', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Partial' });
      const result = await tool.handler(db, { id, domain: 'science' });
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
      expect(result.domain).toBe('science');
      expect(result.title).toBeNull();
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999, title: 'Nope' })).rejects.toThrow();
    });
  });

  describe('rmbr_study_add_note', () => {
    const tool = findTool('rmbr_study_add_note');

    it('adds a note to a study topic', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      const result = await tool.handler(db, { id, note: 'First note' });
      const notes: string[] = JSON.parse(result.notes as string) as string[];
      expect(notes).toEqual(['First note']);
    });

    it('appends multiple notes', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      await tool.handler(db, { id, note: 'First note' });
      const result = await tool.handler(db, { id, note: 'Second note' });
      const notes: string[] = JSON.parse(result.notes as string) as string[];
      expect(notes).toEqual(['First note', 'Second note']);
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999, note: 'nope' })).rejects.toThrow();
    });
  });

  describe('rmbr_study_add_resource', () => {
    const tool = findTool('rmbr_study_add_resource');

    it('adds a resource to a study topic', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      const result = await tool.handler(db, { id, resource: 'https://example.com' });
      const resources: string[] = JSON.parse(result.resources as string) as string[];
      expect(resources).toEqual(['https://example.com']);
    });

    it('appends multiple resources', async () => {
      const id = insertStudyTopic(db, { raw_input: 'Test topic' });
      await tool.handler(db, { id, resource: 'https://example.com' });
      const result = await tool.handler(db, { id, resource: 'https://docs.example.com' });
      const resources: string[] = JSON.parse(result.resources as string) as string[];
      expect(resources).toEqual(['https://example.com', 'https://docs.example.com']);
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999, resource: 'https://x.com' })).rejects.toThrow();
    });
  });

  describe('rmbr_study_next', () => {
    const tool = findTool('rmbr_study_next');

    it('returns the next queued study topic', async () => {
      insertStudyTopic(db, { raw_input: 'First queued' });
      insertStudyTopic(db, { raw_input: 'Second queued' });

      const result = await tool.handler(db, {});
      expect(result.found).toBe(true);
      expect(result.raw_input).toBe('First queued');
    });

    it('skips non-queued topics', async () => {
      insertStudyTopic(db, { raw_input: 'In progress', status: StudyStatus.InProgress });
      insertStudyTopic(db, { raw_input: 'Queued one', status: StudyStatus.Queued });

      const result = await tool.handler(db, {});
      expect(result.found).toBe(true);
      expect(result.raw_input).toBe('Queued one');
    });

    it('returns found=false when no queued topics exist', async () => {
      insertStudyTopic(db, { raw_input: 'Done', status: StudyStatus.Completed });
      const result = await tool.handler(db, {});
      expect(result.found).toBe(false);
    });

    it('returns found=false when no topics exist', async () => {
      const result = await tool.handler(db, {});
      expect(result.found).toBe(false);
    });
  });
});
