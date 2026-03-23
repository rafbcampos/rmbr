import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { ValidationError } from '../../core/errors.ts';
import { getString, getNumber, extractFields, extractPagination } from '../../shared/tool-args.ts';
import { entityToToolResult, paginatedToToolResult } from '../../shared/tool-result.ts';
import { GoalService } from './service.ts';
import type { GoalFilters } from './service.ts';
import { isGoalStatus, isQuarter } from './types.ts';

const GOAL_ENRICH_SPECS = [
  { name: 'title', type: 'string' as const },
  { name: 'kpis', type: 'string' as const },
  { name: 'year', type: 'number' as const },
];

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
      const { fields } = extractFields(args, GOAL_ENRICH_SPECS);
      const quarterStr = typeof args.quarter === 'string' ? args.quarter : undefined;
      if (quarterStr !== undefined && isQuarter(quarterStr)) {
        fields['quarter'] = quarterStr;
      }
      if (Object.keys(fields).length > 0) {
        const enriched = GoalService.enrich(db, goal.id, fields);
        return entityToToolResult(enriched);
      }
      return entityToToolResult(goal);
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
      include_deleted: z.boolean().optional().describe('Include soft-deleted goals'),
      page: z.number().optional().describe('Page number'),
      page_size: z.number().optional().describe('Page size'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const statusStr = typeof args.status === 'string' ? args.status : undefined;
      const quarterStr = typeof args.quarter === 'string' ? args.quarter : undefined;
      const filters: GoalFilters = {
        status: statusStr !== undefined && isGoalStatus(statusStr) ? statusStr : undefined,
        quarter: quarterStr !== undefined && isQuarter(quarterStr) ? quarterStr : undefined,
        year: typeof args.year === 'number' ? args.year : undefined,
        includeDeleted: args.include_deleted === true ? true : undefined,
      };
      return paginatedToToolResult(GoalService.list(db, filters, extractPagination(args)));
    },
  },
  {
    name: 'rmbr_goal_get',
    description: 'Get a goal by ID',
    schema: {
      id: z.number().describe('Goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(GoalService.getById(db, getNumber(args, 'id')));
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
        throw new ValidationError(`Invalid status: '${statusStr}'`);
      }
      return entityToToolResult(GoalService.transition(db, getNumber(args, 'id'), statusStr));
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
      const { fields } = extractFields(args, GOAL_ENRICH_SPECS);
      const quarterStr = typeof args.quarter === 'string' ? args.quarter : undefined;
      if (quarterStr !== undefined && isQuarter(quarterStr)) {
        fields['quarter'] = quarterStr;
      }
      return entityToToolResult(GoalService.enrich(db, getNumber(args, 'id'), fields));
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
      return entityToToolResult(narrative);
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
        data: narratives.map(entityToToolResult),
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
        throw new ValidationError(`Invalid quarter: '${quarterStr}'`);
      }
      const data = GoalService.getQuarterlyReviewData(db, quarterStr, getNumber(args, 'year'));
      return {
        goal_count: data.goals.length,
        narrative_count: data.starNarratives.length,
        has_existing_review: data.existingReview !== null,
        goals: data.goals.map(entityToToolResult),
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
        throw new ValidationError(`Invalid quarter: '${quarterStr}'`);
      }
      const review = GoalService.saveQuarterlyReview(db, {
        quarter: quarterStr,
        year: getNumber(args, 'year'),
        what_went_well: getString(args, 'what_went_well'),
        improvements: getString(args, 'improvements'),
        kpi_summary: getString(args, 'kpi_summary'),
        generated_narrative: getString(args, 'generated_narrative'),
      });
      return entityToToolResult(review);
    },
  },
  {
    name: 'rmbr_goal_delete',
    description: 'Soft-delete a goal',
    schema: {
      id: z.number().describe('Goal ID'),
    },
    annotations: { destructiveHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      GoalService.softDeleteEntity(db, id);
      return { id, deleted: true };
    },
  },
  {
    name: 'rmbr_goal_restore',
    description: 'Restore a soft-deleted goal',
    schema: {
      id: z.number().describe('Goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      GoalService.restoreEntity(db, id);
      return entityToToolResult(GoalService.getById(db, id));
    },
  },
  {
    name: 'rmbr_goal_related',
    description: 'Get all entities related to a goal (todos, kudos, study topics, slack messages)',
    schema: {
      goal_id: z.number().describe('Goal ID'),
    },
    annotations: { readOnlyHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const related = GoalService.getRelatedEntities(db, getNumber(args, 'goal_id'));
      return {
        todo_count: related.todos.length,
        kudos_count: related.kudos.length,
        study_count: related.studyTopics.length,
        slack_count: related.slackMessages.length,
        todos: related.todos.map(entityToToolResult),
        kudos: related.kudos.map(entityToToolResult),
        study_topics: related.studyTopics.map(entityToToolResult),
        slack_messages: related.slackMessages.map(entityToToolResult),
      };
    },
  },
];
