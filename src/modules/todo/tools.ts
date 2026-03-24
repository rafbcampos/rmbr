import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { getString, getNumber, extractFields, extractPagination } from '../../shared/tool-args.ts';
import { entityToToolResult } from '../../shared/tool-result.ts';
import { TodoService } from './service.ts';
import { TimeEntryService } from './time-entry-service.ts';
import { parseTodoStatus } from './types.ts';

const TODO_ENRICH_SPECS = [
  { name: 'title', type: 'string' as const },
  { name: 'priority', type: 'string' as const },
  { name: 'due_date', type: 'string' as const },
  { name: 'goal_id', type: 'number' as const },
];

export const todoTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_todo_create',
    description: `Create a new todo. Provide enrichment fields to create a fully enriched entity in one step. ${ENRICHMENT_PROMPTS.todo}`,
    schema: {
      raw_input: z.string().describe('The raw todo input from the user'),
      title: z.string().optional().describe('Clear, actionable title'),
      priority: z.string().optional().describe('Priority: low, medium, high, critical'),
      due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
      goal_id: z.number().optional().describe('Associated goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const todo = TodoService.create(db, getString(args, 'raw_input'));
      const { hasEnrichment, fields } = extractFields(args, TODO_ENRICH_SPECS);
      if (hasEnrichment) {
        const enriched = TodoService.enrich(db, todo.id, fields);
        return entityToToolResult(enriched);
      }
      return entityToToolResult(todo);
    },
  },
  {
    name: 'rmbr_todo_list',
    description: 'List todos with optional status filter',
    schema: {
      status: z.string().optional(),
      overdue: z.boolean().optional().describe('Filter overdue todos'),
      due_today: z.boolean().optional().describe('Filter todos due today'),
      due_this_week: z.boolean().optional().describe('Filter todos due this week'),
      include_deleted: z.boolean().optional().describe('Include soft-deleted todos'),
      page: z.number().optional(),
      page_size: z.number().optional(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const statusVal = args.status;
      const filters = {
        ...(typeof statusVal === 'string' ? { status: parseTodoStatus(statusVal) } : {}),
        ...(args.overdue === true ? { overdue: true } : {}),
        ...(args.due_today === true ? { dueToday: true } : {}),
        ...(args.due_this_week === true ? { dueThisWeek: true } : {}),
        ...(args.include_deleted === true ? { includeDeleted: true } : {}),
      };
      const result = TodoService.list(db, filters, extractPagination(args));
      const dataWithTime = result.data.map(todo => {
        const elapsed = TimeEntryService.totalElapsed(db, todo.id);
        return { ...entityToToolResult(todo), total_elapsed_seconds: elapsed };
      });
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: dataWithTime,
      };
    },
  },
  {
    name: 'rmbr_todo_get',
    description: 'Get a single todo by id, including time tracking sessions and total elapsed time',
    schema: {
      id: z.number(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      const todoWithTime = TodoService.getByIdWithTime(db, id);
      const entries = TimeEntryService.listForTodo(db, id);
      return {
        ...entityToToolResult(todoWithTime),
        time_entries: entries.map(e => ({
          id: e.id,
          started_at: e.started_at,
          stopped_at: e.stopped_at,
          duration_seconds: e.duration_seconds,
        })),
      };
    },
  },
  {
    name: 'rmbr_todo_transition',
    description: 'Transition a todo to a new status',
    schema: {
      id: z.number(),
      status: z.string(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const todo = TodoService.transition(
        db,
        getNumber(args, 'id'),
        parseTodoStatus(getString(args, 'status')),
      );
      return entityToToolResult(todo);
    },
  },
  {
    name: 'rmbr_todo_enrich',
    description: `Enrich a todo with structured data. ${ENRICHMENT_PROMPTS.todo}`,
    schema: {
      id: z.number(),
      title: z.string().optional(),
      priority: z.string().optional(),
      due_date: z.string().optional(),
      goal_id: z.number().optional(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const { fields } = extractFields(args, TODO_ENRICH_SPECS);
      return entityToToolResult(TodoService.enrich(db, getNumber(args, 'id'), fields));
    },
  },
  {
    name: 'rmbr_todo_delete',
    description: 'Soft-delete a todo',
    schema: {
      id: z.number().describe('The todo ID'),
    },
    annotations: { destructiveHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      TodoService.softDeleteEntity(db, id);
      return { id, deleted: true };
    },
  },
  {
    name: 'rmbr_todo_restore',
    description: 'Restore a soft-deleted todo',
    schema: {
      id: z.number().describe('The todo ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      TodoService.restoreEntity(db, id);
      return entityToToolResult(TodoService.getById(db, id));
    },
  },
  {
    name: 'rmbr_todo_estimate',
    description:
      'Returns completed todos with their actual duration in seconds. Use this data to estimate how long a new or existing todo might take by finding similar completed work.',
    schema: {
      goal_id: z.number().optional().describe('Filter by goal ID'),
      priority: z.string().optional().describe('Filter by priority: low, medium, high, critical'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    annotations: { readOnlyHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters = {
        ...(typeof args.goal_id === 'number' ? { goalId: args.goal_id } : {}),
        ...(typeof args.priority === 'string' ? { priority: args.priority } : {}),
        ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
      };
      const completed = TimeEntryService.getCompletedWithDuration(db, filters);
      return {
        data: completed.map(todo => ({
          id: todo.id,
          title: todo.title,
          priority: todo.priority,
          goal_id: todo.goal_id,
          total_elapsed_seconds: todo.total_elapsed_seconds,
        })),
      };
    },
  },
];
