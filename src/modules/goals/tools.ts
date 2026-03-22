import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import * as GoalService from './service.ts';
import type { Goal, StarNarrative } from './types.ts';
import { isGoalStatus, isQuarter } from './types.ts';
import { getString, getNumber } from '../../shared/tool-args.ts';

function goalToToolResult(goal: Goal): ToolResult {
  return {
    id: goal.id,
    raw_input: goal.raw_input,
    title: goal.title,
    status: goal.status,
    quarter: goal.quarter,
    year: goal.year,
    kpis: goal.kpis,
    enrichment_status: goal.enrichment_status,
    created_at: goal.created_at,
    updated_at: goal.updated_at,
  };
}

function narrativeToToolResult(n: StarNarrative): ToolResult {
  return {
    id: n.id,
    goal_id: n.goal_id,
    situation: n.situation,
    task: n.task,
    action: n.action,
    result: n.result,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}

export const goalsTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_goal_create',
    description: `Create a new goal. Provide enrichment fields to create a fully enriched entity in one step. ${ENRICHMENT_PROMPTS.goals}`,
    schema: {
      raw_input: z.string().describe('Goal description'),
      title: z.string().optional().describe('Goal title (5-10 words)'),
      quarter: z.string().optional().describe('Quarter: Q1, Q2, Q3, Q4'),
      year: z.number().optional().describe('Year'),
      kpis: z.string().optional().describe('KPIs as JSON array of strings'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const goal = GoalService.create(db, getString(args, 'raw_input'));
      const fields: Record<string, string | number> = {};
      if (typeof args.title === 'string') fields['title'] = args.title;
      if (typeof args.quarter === 'string') fields['quarter'] = args.quarter;
      if (typeof args.year === 'number') fields['year'] = args.year;
      if (typeof args.kpis === 'string') fields['kpis'] = args.kpis;
      if (Object.keys(fields).length > 0) {
        const enriched = GoalService.enrich(db, goal.id, fields);
        return goalToToolResult(enriched);
      }
      return goalToToolResult(goal);
    },
  },
  {
    name: 'rmbr_goal_list',
    description: 'List goals with optional filters',
    schema: {
      status: z
        .string()
        .optional()
        .describe('Filter by status: draft, active, completed, abandoned'),
      quarter: z.string().optional().describe('Filter by quarter: Q1, Q2, Q3, Q4'),
      year: z.number().optional().describe('Filter by year'),
      page: z.number().optional().describe('Page number'),
      page_size: z.number().optional().describe('Page size'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const statusStr = typeof args.status === 'string' ? args.status : undefined;
      const quarterStr = typeof args.quarter === 'string' ? args.quarter : undefined;
      const filters: GoalService.GoalFilters = {
        status: statusStr !== undefined && isGoalStatus(statusStr) ? statusStr : undefined,
        quarter: quarterStr !== undefined && isQuarter(quarterStr) ? quarterStr : undefined,
        year: typeof args.year === 'number' ? args.year : undefined,
      };
      const pagination = {
        page: typeof args.page === 'number' ? args.page : 1,
        pageSize: typeof args.page_size === 'number' ? args.page_size : 20,
      };
      const result = GoalService.list(db, filters, pagination);
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: result.data.map(goalToToolResult),
      };
    },
  },
  {
    name: 'rmbr_goal_get',
    description: 'Get a goal by ID',
    schema: {
      id: z.number().describe('Goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const goal = GoalService.getById(db, getNumber(args, 'id'));
      return goalToToolResult(goal);
    },
  },
  {
    name: 'rmbr_goal_transition',
    description: 'Transition a goal to a new status',
    schema: {
      id: z.number().describe('Goal ID'),
      status: z.string().describe('New status: active, completed, abandoned'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const statusStr = getString(args, 'status');
      if (!isGoalStatus(statusStr)) {
        return { error: `Invalid status: ${statusStr}` };
      }
      const goal = GoalService.transition(db, getNumber(args, 'id'), statusStr);
      return goalToToolResult(goal);
    },
  },
  {
    name: 'rmbr_goal_enrich',
    description: `Enrich a goal with additional details. ${ENRICHMENT_PROMPTS.goals}`,
    schema: {
      id: z.number().describe('Goal ID'),
      title: z.string().optional().describe('Goal title'),
      quarter: z.string().optional().describe('Quarter: Q1, Q2, Q3, Q4'),
      year: z.number().optional().describe('Year'),
      kpis: z.string().optional().describe('KPIs as JSON array'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const fields: Record<string, string | number> = {};
      if (typeof args.title === 'string') fields['title'] = args.title;
      if (typeof args.quarter === 'string') fields['quarter'] = args.quarter;
      if (typeof args.year === 'number') fields['year'] = args.year;
      if (typeof args.kpis === 'string') fields['kpis'] = args.kpis;
      const goal = GoalService.enrich(db, getNumber(args, 'id'), fields);
      return goalToToolResult(goal);
    },
  },
  {
    name: 'rmbr_goal_add_star_narrative',
    description: 'Add a STAR narrative to a goal',
    schema: {
      goal_id: z.number().describe('Goal ID'),
      situation: z.string().describe('Situation description'),
      task: z.string().describe('Task description'),
      action: z.string().describe('Action taken'),
      result: z.string().describe('Result achieved'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const narrative = GoalService.addStarNarrative(db, getNumber(args, 'goal_id'), {
        situation: getString(args, 'situation'),
        task: getString(args, 'task'),
        action: getString(args, 'action'),
        result: getString(args, 'result'),
      });
      return narrativeToToolResult(narrative);
    },
  },
  {
    name: 'rmbr_goal_get_star_narratives',
    description: 'Get all STAR narratives for a goal',
    schema: {
      goal_id: z.number().describe('Goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const narratives = GoalService.getStarNarratives(db, getNumber(args, 'goal_id'));
      return {
        count: narratives.length,
        goal_id: getNumber(args, 'goal_id'),
        data: narratives.map(narrativeToToolResult),
      };
    },
  },
  {
    name: 'rmbr_goal_quarterly_review_data',
    description: 'Get quarterly review data for goals',
    schema: {
      quarter: z.string().describe('Quarter: Q1, Q2, Q3, Q4'),
      year: z.number().describe('Year'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const quarterStr = getString(args, 'quarter');
      if (!isQuarter(quarterStr)) {
        return { error: `Invalid quarter: ${quarterStr}` };
      }
      const data = GoalService.getQuarterlyReviewData(db, quarterStr, getNumber(args, 'year'));
      return {
        goal_count: data.goals.length,
        narrative_count: data.starNarratives.length,
        has_existing_review: data.existingReview !== null,
        goals: data.goals.map(goalToToolResult),
      };
    },
  },
  {
    name: 'rmbr_goal_save_quarterly_review',
    description: 'Save or update a quarterly review',
    schema: {
      quarter: z.string().describe('Quarter: Q1, Q2, Q3, Q4'),
      year: z.number().describe('Year'),
      what_went_well: z.string().describe('What went well'),
      improvements: z.string().describe('Areas for improvement'),
      kpi_summary: z.string().describe('KPI summary'),
      generated_narrative: z.string().describe('Generated narrative'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const quarterStr = getString(args, 'quarter');
      if (!isQuarter(quarterStr)) {
        return { error: `Invalid quarter: ${quarterStr}` };
      }
      const review = GoalService.saveQuarterlyReview(db, {
        quarter: quarterStr,
        year: getNumber(args, 'year'),
        what_went_well: getString(args, 'what_went_well'),
        improvements: getString(args, 'improvements'),
        kpi_summary: getString(args, 'kpi_summary'),
        generated_narrative: getString(args, 'generated_narrative'),
      });
      return {
        id: review.id,
        quarter: review.quarter,
        year: review.year,
        what_went_well: review.what_went_well,
        improvements: review.improvements,
        kpi_summary: review.kpi_summary,
        generated_narrative: review.generated_narrative,
        created_at: review.created_at,
        updated_at: review.updated_at,
      };
    },
  },
];
