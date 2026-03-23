import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { getString, getNumber, extractFields } from '../../shared/tool-args.ts';
import { entityToToolResult, paginatedToToolResult } from '../../shared/tool-result.ts';
import type { KudosFilters } from './service.ts';
import { KudosService } from './service.ts';
import { isKudosDirection } from './types.ts';

const KUDOS_ENRICH_SPECS = [
  { name: 'direction', type: 'string' as const },
  { name: 'person', type: 'string' as const },
  { name: 'summary', type: 'string' as const },
  { name: 'context', type: 'string' as const },
  { name: 'goal_id', type: 'number' as const },
];

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
      const kudos = KudosService.create(db, getString(args, 'raw_input'));
      const { hasEnrichment, fields } = extractFields(args, KUDOS_ENRICH_SPECS);
      if (fields['direction'] !== undefined && !isKudosDirection(String(fields['direction']))) {
        delete fields['direction'];
      }
      if (hasEnrichment) {
        const enriched = KudosService.enrich(db, kudos.id, fields);
        return entityToToolResult(enriched);
      }
      return entityToToolResult(kudos);
    },
  },
  {
    name: 'rmbr_kudos_list',
    description: 'List kudos entries with optional filters',
    schema: {
      direction: z.enum(['given', 'received']).optional().describe('Filter by direction'),
      person: z.string().optional().describe('Filter by person'),
      include_deleted: z.boolean().optional().describe('Include soft-deleted kudos'),
      page: z.number().optional().describe('Page number'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters: KudosFilters = {
        ...(typeof args.direction === 'string' && isKudosDirection(args.direction)
          ? { direction: args.direction }
          : {}),
        ...(typeof args.person === 'string' ? { person: args.person } : {}),
        ...(args.include_deleted === true ? { includeDeleted: true } : {}),
      };
      const page = typeof args.page === 'number' ? args.page : 1;
      return paginatedToToolResult(KudosService.list(db, filters, { page, pageSize: 20 }));
    },
  },
  {
    name: 'rmbr_kudos_get',
    description: 'Get a single kudos entry by ID',
    schema: {
      id: z.number().describe('The kudos ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(KudosService.getById(db, getNumber(args, 'id')));
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
      const { fields } = extractFields(args, KUDOS_ENRICH_SPECS);
      if (fields['direction'] !== undefined && !isKudosDirection(String(fields['direction']))) {
        delete fields['direction'];
      }
      return entityToToolResult(KudosService.enrich(db, getNumber(args, 'id'), fields));
    },
  },
  {
    name: 'rmbr_kudos_delete',
    description: 'Soft-delete a kudos entry',
    schema: {
      id: z.number().describe('The kudos ID'),
    },
    annotations: { destructiveHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      KudosService.softDeleteEntity(db, id);
      return { id, deleted: true };
    },
  },
  {
    name: 'rmbr_kudos_restore',
    description: 'Restore a soft-deleted kudos entry',
    schema: {
      id: z.number().describe('The kudos ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      KudosService.restoreEntity(db, id);
      return entityToToolResult(KudosService.getById(db, id));
    },
  },
];
