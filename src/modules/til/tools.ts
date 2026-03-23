import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { getString, getNumber, extractFields } from '../../shared/tool-args.ts';
import { entityToToolResult, paginatedToToolResult } from '../../shared/tool-result.ts';
import { TilService } from './service.ts';

const TIL_ENRICH_SPECS = [
  { name: 'title', type: 'string' as const },
  { name: 'content', type: 'string' as const },
  { name: 'domain', type: 'string' as const },
  { name: 'tags', type: 'string' as const },
];

export const tilTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_til_create',
    description: `Create a new TIL (today I learned) entry. Provide enrichment fields to create a fully enriched entity in one step. ${ENRICHMENT_PROMPTS.til}`,
    schema: {
      raw_input: z.string().describe('The raw TIL input text'),
      title: z.string().optional().describe('Concise, descriptive title'),
      content: z.string().optional().describe('Structured explanation'),
      domain: z.string().optional().describe('Lowercase domain tag'),
      tags: z.string().optional().describe('JSON array of keyword tags'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const created = TilService.create(db, getString(args, 'raw_input'));
      const { hasEnrichment, fields } = extractFields(args, TIL_ENRICH_SPECS);
      if (hasEnrichment) {
        const enriched = TilService.enrich(db, created.id, fields);
        return entityToToolResult(enriched);
      }
      return entityToToolResult(created);
    },
  },
  {
    name: 'rmbr_til_list',
    description: 'List TIL entries with optional filters',
    schema: {
      domain: z.string().optional().describe('Filter by domain'),
      include_deleted: z.boolean().optional().describe('Include soft-deleted TIL entries'),
      page: z.number().optional().describe('Page number'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters = {
        ...(typeof args.domain === 'string' ? { domain: args.domain } : {}),
        ...(args.include_deleted === true ? { includeDeleted: true } : {}),
      };
      const page = typeof args.page === 'number' ? args.page : 1;
      return paginatedToToolResult(TilService.list(db, filters, { page, pageSize: 20 }));
    },
  },
  {
    name: 'rmbr_til_get',
    description: 'Get a single TIL entry by ID',
    schema: {
      id: z.number().describe('The TIL ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(TilService.getById(db, getNumber(args, 'id')));
    },
  },
  {
    name: 'rmbr_til_search',
    description: 'Full-text search TIL entries',
    schema: {
      query: z.string().describe('Search query'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const results = TilService.search(db, getString(args, 'query'));
      return { data: results.map(entityToToolResult) };
    },
  },
  {
    name: 'rmbr_til_domains',
    description: 'List all TIL domains',
    schema: {},
    handler: async (db): Promise<ToolResult> => {
      const domains = TilService.getDomains(db);
      return { data: domains.join(',') };
    },
  },
  {
    name: 'rmbr_til_enrich',
    description: `Enrich a TIL entry with structured data. ${ENRICHMENT_PROMPTS.til}`,
    schema: {
      id: z.number().describe('The TIL ID'),
      title: z.string().optional().describe('Title'),
      content: z.string().optional().describe('Content'),
      domain: z.string().optional().describe('Domain'),
      tags: z.string().optional().describe('Tags (JSON array)'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const { fields } = extractFields(args, TIL_ENRICH_SPECS);
      return entityToToolResult(TilService.enrich(db, getNumber(args, 'id'), fields));
    },
  },
  {
    name: 'rmbr_til_delete',
    description: 'Soft-delete a TIL entry',
    schema: {
      id: z.number().describe('The TIL ID'),
    },
    annotations: { destructiveHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      TilService.softDeleteEntity(db, id);
      return { id, deleted: true };
    },
  },
  {
    name: 'rmbr_til_restore',
    description: 'Restore a soft-deleted TIL entry',
    schema: {
      id: z.number().describe('The TIL ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      TilService.restoreEntity(db, id);
      return entityToToolResult(TilService.getById(db, id));
    },
  },
];
