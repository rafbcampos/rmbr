import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { ValidationError } from '../../core/errors.ts';
import { getString, getNumber } from '../../shared/tool-args.ts';
import { entityToToolResult, paginatedToToolResult } from '../../shared/tool-result.ts';
import type { SlackFilters } from './service.ts';
import { SlackService } from './service.ts';
import { isSlackSentiment } from './types.ts';

export const slackTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_slack_ingest',
    description: `Ingest a new Slack message. After ingesting, enrich it. ${ENRICHMENT_PROMPTS.slack}`,
    schema: {
      raw_content: z.string().describe('The raw message content'),
      channel: z.string().optional().describe('Channel name'),
      sender: z.string().optional().describe('Sender name'),
      message_ts: z.string().optional().describe('Message timestamp'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const rawContent = getString(args, 'raw_content');
      const channel = typeof args.channel === 'string' ? args.channel : undefined;
      const sender = typeof args.sender === 'string' ? args.sender : undefined;
      const messageTs = typeof args.message_ts === 'string' ? args.message_ts : undefined;
      const msg = SlackService.ingest(db, rawContent, channel, sender, messageTs);
      return entityToToolResult(msg);
    },
  },
  {
    name: 'rmbr_slack_list',
    description: 'List Slack messages with optional filters',
    schema: {
      channel: z.string().optional().describe('Filter by channel'),
      processed: z.number().optional().describe('Filter by processed status (0 or 1)'),
      sentiment: z
        .enum(['positive', 'negative', 'neutral'])
        .optional()
        .describe('Filter by sentiment'),
      include_deleted: z.boolean().optional().describe('Include soft-deleted messages'),
      page: z.number().optional().describe('Page number'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters: SlackFilters = {
        ...(typeof args.channel === 'string' ? { channel: args.channel } : {}),
        ...(typeof args.processed === 'number' ? { processed: args.processed } : {}),
        ...(typeof args.sentiment === 'string' && isSlackSentiment(args.sentiment)
          ? { sentiment: args.sentiment }
          : {}),
        ...(args.include_deleted === true ? { includeDeleted: true } : {}),
      };
      const page = typeof args.page === 'number' ? args.page : 1;
      return paginatedToToolResult(SlackService.list(db, filters, { page, pageSize: 20 }));
    },
  },
  {
    name: 'rmbr_slack_get',
    description: 'Get a single Slack message by ID',
    schema: {
      id: z.number().describe('The message ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(SlackService.getById(db, getNumber(args, 'id')));
    },
  },
  {
    name: 'rmbr_slack_set_sentiment',
    description: 'Set sentiment on a Slack message',
    schema: {
      id: z.number().describe('The message ID'),
      sentiment: z.enum(['positive', 'negative', 'neutral']).describe('The sentiment value'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const sentimentStr = getString(args, 'sentiment');
      if (!isSlackSentiment(sentimentStr)) {
        throw new ValidationError(`Invalid sentiment: '${sentimentStr}'`);
      }
      return entityToToolResult(SlackService.setSentiment(db, getNumber(args, 'id'), sentimentStr));
    },
  },
  {
    name: 'rmbr_slack_link_todo',
    description: 'Link a Slack message to a todo',
    schema: {
      id: z.number().describe('The message ID'),
      todo_id: z.number().describe('The todo ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(
        SlackService.linkTodo(db, getNumber(args, 'id'), getNumber(args, 'todo_id')),
      );
    },
  },
  {
    name: 'rmbr_slack_link_goal',
    description: 'Link a Slack message to a goal',
    schema: {
      id: z.number().describe('The message ID'),
      goal_id: z.number().describe('The goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(
        SlackService.linkGoal(db, getNumber(args, 'id'), getNumber(args, 'goal_id')),
      );
    },
  },
  {
    name: 'rmbr_slack_mark_processed',
    description: 'Mark a Slack message as processed',
    schema: {
      id: z.number().describe('The message ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(SlackService.markProcessed(db, getNumber(args, 'id')));
    },
  },
  {
    name: 'rmbr_slack_delete',
    description: 'Soft-delete a Slack message',
    schema: {
      id: z.number().describe('The message ID'),
    },
    annotations: { destructiveHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      SlackService.softDeleteEntity(db, id);
      return { id, deleted: true };
    },
  },
  {
    name: 'rmbr_slack_restore',
    description: 'Restore a soft-deleted Slack message',
    schema: {
      id: z.number().describe('The message ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      SlackService.restoreEntity(db, id);
      return entityToToolResult(SlackService.getById(db, id));
    },
  },
];
