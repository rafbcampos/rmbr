import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { TilService } from './service.ts';

function tilToToolResult(til: ReturnType<typeof TilService.getById>): ToolResult {
  return {
    id: til.id,
    raw_input: til.raw_input,
    title: til.title,
    content: til.content,
    domain: til.domain,
    tags: til.tags,
    enrichment_status: til.enrichment_status,
    created_at: til.created_at,
    updated_at: til.updated_at,
  };
}

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
      const rawInput = args.raw_input;
      if (typeof rawInput !== 'string') {
        throw new Error('raw_input must be a string');
      }
      const created = TilService.create(db, rawInput);
      const hasEnrichment =
        typeof args.title === 'string' ||
        typeof args.content === 'string' ||
        typeof args.domain === 'string' ||
        typeof args.tags === 'string';
      if (hasEnrichment) {
        const fields: Record<string, string> = {};
        if (typeof args.title === 'string') fields['title'] = args.title;
        if (typeof args.content === 'string') fields['content'] = args.content;
        if (typeof args.domain === 'string') fields['domain'] = args.domain;
        if (typeof args.tags === 'string') fields['tags'] = args.tags;
        const enriched = TilService.enrich(db, created.id, fields);
        return tilToToolResult(enriched);
      }
      return tilToToolResult(created);
    },
  },
  {
    name: 'rmbr_til_list',
    description: 'List TIL entries with optional filters',
    schema: {
      domain: z.string().optional().describe('Filter by domain'),
      page: z.number().optional().describe('Page number'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters = typeof args.domain === 'string' ? { domain: args.domain } : {};
      const page = typeof args.page === 'number' ? args.page : 1;
      const result = TilService.list(db, filters, { page, pageSize: 20 });
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: result.data.map(tilToToolResult),
      };
    },
  },
  {
    name: 'rmbr_til_get',
    description: 'Get a single TIL entry by ID',
    schema: {
      id: z.number().describe('The TIL ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = args.id;
      if (typeof id !== 'number') {
        throw new Error('id must be a number');
      }
      const til = TilService.getById(db, id);
      return tilToToolResult(til);
    },
  },
  {
    name: 'rmbr_til_search',
    description: 'Full-text search TIL entries',
    schema: {
      query: z.string().describe('Search query'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const query = args.query;
      if (typeof query !== 'string') {
        throw new Error('query must be a string');
      }
      const results = TilService.search(db, query);
      return {
        data: results.map(tilToToolResult),
      };
    },
  },
  {
    name: 'rmbr_til_domains',
    description: 'List all TIL domains',
    schema: {},
    handler: async (db): Promise<ToolResult> => {
      const domains = TilService.getDomains(db);
      return {
        data: domains.join(','),
      };
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
      const id = args.id;
      if (typeof id !== 'number') {
        throw new Error('id must be a number');
      }
      const fields: Record<string, string> = {};
      if (typeof args.title === 'string') {
        fields['title'] = args.title;
      }
      if (typeof args.content === 'string') {
        fields['content'] = args.content;
      }
      if (typeof args.domain === 'string') {
        fields['domain'] = args.domain;
      }
      if (typeof args.tags === 'string') {
        fields['tags'] = args.tags;
      }
      const til = TilService.enrich(db, id, fields);
      return tilToToolResult(til);
    },
  },
];
