import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { goalsMigrations as migrations } from '../../../src/modules/goals/schema.ts';
import { goalsTools } from '../../../src/modules/goals/tools.ts';
import { GoalStatus, Quarter, EnrichmentStatus } from '../../../src/core/types.ts';
import type { McpToolDefinition } from '../../../src/core/module-contract.ts';
import { getDataArray } from '../../helpers/tool-result.ts';

function findTool(name: string): McpToolDefinition {
  const tool = goalsTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

describe('goals tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(migrations);
  });

  describe('rmbr_goal_create', () => {
    const tool = findTool('rmbr_goal_create');

    it('should create a goal with raw input only', async () => {
      const result = await tool.handler(db, { raw_input: 'Ship feature X' });

      expect(result.id).toBe(1);
      expect(result.raw_input).toBe('Ship feature X');
      expect(result.status).toBe(GoalStatus.Draft);
      expect(result.title).toBeNull();
      expect(result.quarter).toBeNull();
      expect(result.year).toBeNull();
      expect(result.kpis).toBe('[]');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
    });

    it('should create a goal with enrichment fields', async () => {
      const result = await tool.handler(db, {
        raw_input: 'Improve test coverage to 90%',
        title: 'Boost Test Coverage',
        quarter: Quarter.Q2,
        year: 2026,
        kpis: '["coverage >= 90%"]',
      });

      expect(result.id).toBe(1);
      expect(result.title).toBe('Boost Test Coverage');
      expect(result.quarter).toBe(Quarter.Q2);
      expect(result.year).toBe(2026);
      expect(result.kpis).toBe('["coverage >= 90%"]');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });
  });

  describe('rmbr_goal_list', () => {
    const tool = findTool('rmbr_goal_list');
    const createTool = findTool('rmbr_goal_create');
    const transitionTool = findTool('rmbr_goal_transition');

    it('should list all goals', async () => {
      await createTool.handler(db, { raw_input: 'Goal A' });
      await createTool.handler(db, { raw_input: 'Goal B' });

      const result = await tool.handler(db, {});

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(getDataArray(result).length).toBe(2);
    });

    it('should filter by status', async () => {
      await createTool.handler(db, { raw_input: 'Draft goal' });
      await createTool.handler(db, { raw_input: 'Active goal' });
      await transitionTool.handler(db, { id: 2, status: GoalStatus.Active });

      const result = await tool.handler(db, { status: GoalStatus.Active });

      expect(result.total).toBe(1);
      const data = getDataArray(result);
      expect(data[0]?.status).toBe(GoalStatus.Active);
    });

    it('should filter by quarter', async () => {
      await createTool.handler(db, {
        raw_input: 'Q1 goal',
        quarter: Quarter.Q1,
        year: 2026,
      });
      await createTool.handler(db, {
        raw_input: 'Q2 goal',
        quarter: Quarter.Q2,
        year: 2026,
      });

      const result = await tool.handler(db, { quarter: Quarter.Q1 });

      expect(result.total).toBe(1);
      const data = getDataArray(result);
      expect(data[0]?.quarter).toBe(Quarter.Q1);
    });

    it('should filter by year', async () => {
      await createTool.handler(db, {
        raw_input: '2026 goal',
        quarter: Quarter.Q1,
        year: 2026,
      });
      await createTool.handler(db, {
        raw_input: '2025 goal',
        quarter: Quarter.Q1,
        year: 2025,
      });

      const result = await tool.handler(db, { year: 2026 });

      expect(result.total).toBe(1);
      const data = getDataArray(result);
      expect(data[0]?.year).toBe(2026);
    });

    it('should paginate results', async () => {
      for (let i = 0; i < 5; i++) {
        await createTool.handler(db, { raw_input: `Goal ${i}` });
      }

      const result = await tool.handler(db, { page: 2, page_size: 2 });

      expect(result.total).toBe(5);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(getDataArray(result).length).toBe(2);
    });
  });

  describe('rmbr_goal_get', () => {
    const tool = findTool('rmbr_goal_get');
    const createTool = findTool('rmbr_goal_create');

    it('should get a goal by id', async () => {
      await createTool.handler(db, { raw_input: 'My goal' });

      const result = await tool.handler(db, { id: 1 });

      expect(result.id).toBe(1);
      expect(result.raw_input).toBe('My goal');
      expect(result.status).toBe(GoalStatus.Draft);
    });
  });

  describe('rmbr_goal_transition', () => {
    const tool = findTool('rmbr_goal_transition');
    const createTool = findTool('rmbr_goal_create');

    it('should transition from draft to active', async () => {
      await createTool.handler(db, { raw_input: 'Goal' });

      const result = await tool.handler(db, { id: 1, status: GoalStatus.Active });

      expect(result.status).toBe(GoalStatus.Active);
    });

    it('should throw for invalid status string', async () => {
      await createTool.handler(db, { raw_input: 'Goal' });

      await expect(tool.handler(db, { id: 1, status: 'bogus' })).rejects.toThrow();
    });
  });

  describe('rmbr_goal_enrich', () => {
    const tool = findTool('rmbr_goal_enrich');
    const createTool = findTool('rmbr_goal_create');

    it('should enrich a goal with title, quarter, year, and kpis', async () => {
      await createTool.handler(db, { raw_input: 'Raw goal' });

      const result = await tool.handler(db, {
        id: 1,
        title: 'Enriched Title',
        quarter: Quarter.Q3,
        year: 2026,
        kpis: '["metric-a", "metric-b"]',
      });

      expect(result.title).toBe('Enriched Title');
      expect(result.quarter).toBe(Quarter.Q3);
      expect(result.year).toBe(2026);
      expect(result.kpis).toBe('["metric-a", "metric-b"]');
      expect(result.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });
  });

  describe('rmbr_goal_add_star_narrative', () => {
    const tool = findTool('rmbr_goal_add_star_narrative');
    const createTool = findTool('rmbr_goal_create');

    it('should add a STAR narrative with all fields', async () => {
      await createTool.handler(db, { raw_input: 'Goal with STAR' });

      const result = await tool.handler(db, {
        goal_id: 1,
        situation: 'Legacy system was slow',
        task: 'Migrate to new architecture',
        action: 'Redesigned data layer and migrated incrementally',
        result: 'Latency reduced by 60%',
      });

      expect(result.id).toBe(1);
      expect(result.goal_id).toBe(1);
      expect(result.situation).toBe('Legacy system was slow');
      expect(result.task).toBe('Migrate to new architecture');
      expect(result.action).toBe('Redesigned data layer and migrated incrementally');
      expect(result.result).toBe('Latency reduced by 60%');
      expect(typeof result.created_at).toBe('string');
      expect(typeof result.updated_at).toBe('string');
    });
  });

  describe('rmbr_goal_get_star_narratives', () => {
    const tool = findTool('rmbr_goal_get_star_narratives');
    const createTool = findTool('rmbr_goal_create');
    const addNarrativeTool = findTool('rmbr_goal_add_star_narrative');

    it('should return narratives for a goal', async () => {
      await createTool.handler(db, { raw_input: 'Goal' });
      await addNarrativeTool.handler(db, {
        goal_id: 1,
        situation: 's1',
        task: 't1',
        action: 'a1',
        result: 'r1',
      });
      await addNarrativeTool.handler(db, {
        goal_id: 1,
        situation: 's2',
        task: 't2',
        action: 'a2',
        result: 'r2',
      });

      const result = await tool.handler(db, { goal_id: 1 });

      expect(result.count).toBe(2);
      expect(result.goal_id).toBe(1);
      expect(getDataArray(result).length).toBe(2);
    });

    it('should return zero count for goal with no narratives', async () => {
      await createTool.handler(db, { raw_input: 'Goal' });

      const result = await tool.handler(db, { goal_id: 1 });

      expect(result.count).toBe(0);
      expect(getDataArray(result).length).toBe(0);
    });
  });

  describe('rmbr_goal_quarterly_review_data', () => {
    const tool = findTool('rmbr_goal_quarterly_review_data');
    const createTool = findTool('rmbr_goal_create');

    it('should return goals for a quarter and year', async () => {
      await createTool.handler(db, {
        raw_input: 'Q1 goal',
        quarter: Quarter.Q1,
        year: 2026,
      });

      const result = await tool.handler(db, { quarter: Quarter.Q1, year: 2026 });

      expect(result.goal_count).toBe(1);
      expect(result.has_existing_review).toBe(false);
      const goalsData = result.goals;
      if (!Array.isArray(goalsData)) throw new Error('Expected goals to be an array');
      expect(goalsData.length).toBe(1);
      expect(goalsData[0]?.quarter).toBe(Quarter.Q1);
    });

    it('should throw for invalid quarter', async () => {
      await expect(tool.handler(db, { quarter: 'Q9', year: 2026 })).rejects.toThrow();
    });
  });

  describe('rmbr_goal_save_quarterly_review', () => {
    const tool = findTool('rmbr_goal_save_quarterly_review');

    it('should save a quarterly review with all fields', async () => {
      const result = await tool.handler(db, {
        quarter: Quarter.Q1,
        year: 2026,
        what_went_well: 'Shipped on time',
        improvements: 'More pair programming',
        kpi_summary: 'All KPIs met',
        generated_narrative: 'Strong quarter overall',
      });

      expect(result.id).toBe(1);
      expect(result.quarter).toBe(Quarter.Q1);
      expect(result.year).toBe(2026);
      expect(result.what_went_well).toBe('Shipped on time');
      expect(result.improvements).toBe('More pair programming');
      expect(result.kpi_summary).toBe('All KPIs met');
      expect(result.generated_narrative).toBe('Strong quarter overall');
      expect(typeof result.created_at).toBe('string');
      expect(typeof result.updated_at).toBe('string');
    });

    it('should throw for invalid quarter', async () => {
      await expect(
        tool.handler(db, {
          quarter: 'invalid',
          year: 2026,
          what_went_well: 'x',
          improvements: 'x',
          kpi_summary: 'x',
          generated_narrative: 'x',
        }),
      ).rejects.toThrow();
    });
  });
});
