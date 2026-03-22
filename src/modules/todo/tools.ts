import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import * as TodoService from './service.ts';
import type { Todo } from './types.ts';
import { parseTodoStatus } from './types.ts';
import { getString, getNumber } from '../../shared/tool-args.ts';

function todoToToolResult(todo: Todo): ToolResult {
  return {
    id: todo.id,
    raw_input: todo.raw_input,
    title: todo.title,
    status: todo.status,
    priority: todo.priority,
    due_date: todo.due_date,
    goal_id: todo.goal_id,
    enrichment_status: todo.enrichment_status,
    created_at: todo.created_at,
    updated_at: todo.updated_at,
  };
}

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
      const hasEnrichment =
        typeof args.title === 'string' ||
        typeof args.priority === 'string' ||
        typeof args.due_date === 'string' ||
        typeof args.goal_id === 'number';
      if (hasEnrichment) {
        const enriched = TodoService.enrich(db, todo.id, {
          title: typeof args.title === 'string' ? args.title : undefined,
          priority: typeof args.priority === 'string' ? args.priority : undefined,
          due_date: typeof args.due_date === 'string' ? args.due_date : undefined,
          goal_id: typeof args.goal_id === 'number' ? args.goal_id : undefined,
        });
        return todoToToolResult(enriched);
      }
      return todoToToolResult(todo);
    },
  },
  {
    name: 'rmbr_todo_list',
    description: 'List todos with optional status filter',
    schema: {
      status: z.string().optional(),
      page: z.number().optional(),
      page_size: z.number().optional(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const statusVal = args.status;
      const filters =
        typeof statusVal === 'string' ? { status: parseTodoStatus(statusVal) } : undefined;
      const pageVal = args.page;
      const pageSizeVal = args.page_size;
      const pagination =
        typeof pageVal === 'number' || typeof pageSizeVal === 'number'
          ? {
              page: typeof pageVal === 'number' ? pageVal : 1,
              pageSize: typeof pageSizeVal === 'number' ? pageSizeVal : 20,
            }
          : undefined;
      const result = TodoService.list(db, filters, pagination);
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: result.data.map(todoToToolResult),
      };
    },
  },
  {
    name: 'rmbr_todo_get',
    description: 'Get a single todo by id',
    schema: {
      id: z.number(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const todo = TodoService.getById(db, getNumber(args, 'id'));
      return todoToToolResult(todo);
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
      return todoToToolResult(todo);
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
      const fields: TodoService.EnrichFields = {
        title: typeof args.title === 'string' ? args.title : undefined,
        priority: typeof args.priority === 'string' ? args.priority : undefined,
        due_date: typeof args.due_date === 'string' ? args.due_date : undefined,
        goal_id: typeof args.goal_id === 'number' ? args.goal_id : undefined,
      };
      const todo = TodoService.enrich(db, getNumber(args, 'id'), fields);
      return todoToToolResult(todo);
    },
  },
];
