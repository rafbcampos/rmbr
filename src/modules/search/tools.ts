import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { getString } from '../../shared/tool-args.ts';
import * as SearchService from './service.ts';
import type { SearchResult } from './types.ts';

function searchResultToToolResult(result: SearchResult): ToolResult {
  return {
    entity_type: result.entity_type,
    entity_id: result.entity_id,
    title: result.title,
    snippet: result.snippet,
    created_at: result.created_at,
  };
}

export const searchTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_search',
    description:
      'Search across all entity types (todos, goals, kudos, TILs, study topics, slack messages)',
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    schema: {
      query: z.string().describe('Search query'),
      limit: z.number().optional().describe('Max results (default 20)'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const query = getString(args, 'query');
      const limit = typeof args.limit === 'number' ? args.limit : undefined;
      const results = SearchService.search(db, query, limit);
      return {
        total: results.length,
        data: results.map(searchResultToToolResult),
      };
    },
  },
];
