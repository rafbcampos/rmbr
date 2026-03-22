import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import type { KudosFilters } from './service.ts';
import { KudosService } from './service.ts';
import { isKudosDirection } from './types.ts';

function kudosToToolResult(kudos: ReturnType<typeof KudosService.getById>): ToolResult {
  return {
    id: kudos.id,
    raw_input: kudos.raw_input,
    direction: kudos.direction,
    person: kudos.person,
    summary: kudos.summary,
    context: kudos.context,
    goal_id: kudos.goal_id,
    enrichment_status: kudos.enrichment_status,
    created_at: kudos.created_at,
    updated_at: kudos.updated_at,
  };
}

export const kudosTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_kudos_create',
    description: `Create a new kudos entry. Provide enrichment fields to create a fully enriched entity in one step. ${ENRICHMENT_PROMPTS.kudos}`,
    schema: {
      raw_input: z.string().describe('The raw kudos input text'),
      direction: z.enum(['given', 'received']).optional().describe('Direction of kudos'),
      person: z.string().optional().describe('Person name'),
      summary: z.string().optional().describe('One-sentence summary'),
      context: z.string().optional().describe('Situation or project context'),
      goal_id: z.number().optional().describe('Associated goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const rawInput = args.raw_input;
      if (typeof rawInput !== 'string') {
        throw new Error('raw_input must be a string');
      }
      const kudos = KudosService.create(db, rawInput);
      const hasEnrichment =
        typeof args.direction === 'string' ||
        typeof args.person === 'string' ||
        typeof args.summary === 'string' ||
        typeof args.context === 'string' ||
        typeof args.goal_id === 'number';
      if (hasEnrichment) {
        const fields: Record<string, string | number> = {};
        if (typeof args.direction === 'string') fields['direction'] = args.direction;
        if (typeof args.person === 'string') fields['person'] = args.person;
        if (typeof args.summary === 'string') fields['summary'] = args.summary;
        if (typeof args.context === 'string') fields['context'] = args.context;
        if (typeof args.goal_id === 'number') fields['goal_id'] = args.goal_id;
        const enriched = KudosService.enrich(db, kudos.id, fields);
        return kudosToToolResult(enriched);
      }
      return kudosToToolResult(kudos);
    },
  },
  {
    name: 'rmbr_kudos_list',
    description: 'List kudos entries with optional filters',
    schema: {
      direction: z.enum(['given', 'received']).optional().describe('Filter by direction'),
      person: z.string().optional().describe('Filter by person'),
      page: z.number().optional().describe('Page number'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters: KudosFilters = {
        ...(typeof args.direction === 'string' && isKudosDirection(args.direction)
          ? { direction: args.direction }
          : {}),
        ...(typeof args.person === 'string' ? { person: args.person } : {}),
      };
      const page = typeof args.page === 'number' ? args.page : 1;
      const result = KudosService.list(db, filters, { page, pageSize: 20 });
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: result.data.map(kudosToToolResult),
      };
    },
  },
  {
    name: 'rmbr_kudos_get',
    description: 'Get a single kudos entry by ID',
    schema: {
      id: z.number().describe('The kudos ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = args.id;
      if (typeof id !== 'number') {
        throw new Error('id must be a number');
      }
      const kudos = KudosService.getById(db, id);
      return kudosToToolResult(kudos);
    },
  },
  {
    name: 'rmbr_kudos_enrich',
    description: `Enrich a kudos entry with structured data. ${ENRICHMENT_PROMPTS.kudos}`,
    schema: {
      id: z.number().describe('The kudos ID'),
      direction: z.enum(['given', 'received']).optional().describe('Direction of kudos'),
      person: z.string().optional().describe('Person name'),
      summary: z.string().optional().describe('Summary'),
      context: z.string().optional().describe('Context'),
      goal_id: z.number().optional().describe('Associated goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = args.id;
      if (typeof id !== 'number') {
        throw new Error('id must be a number');
      }
      const fields: Record<string, string | number> = {};
      if (typeof args.direction === 'string') {
        fields['direction'] = args.direction;
      }
      if (typeof args.person === 'string') {
        fields['person'] = args.person;
      }
      if (typeof args.summary === 'string') {
        fields['summary'] = args.summary;
      }
      if (typeof args.context === 'string') {
        fields['context'] = args.context;
      }
      if (typeof args.goal_id === 'number') {
        fields['goal_id'] = args.goal_id;
      }
      const kudos = KudosService.enrich(db, id, fields);
      return kudosToToolResult(kudos);
    },
  },
];
