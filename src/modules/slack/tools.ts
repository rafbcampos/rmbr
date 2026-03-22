import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import type { SlackFilters } from './service.ts';
import { SlackService } from './service.ts';
import { isSlackSentiment } from './types.ts';

function slackMessageToToolResult(msg: ReturnType<typeof SlackService.getById>): ToolResult {
  return {
    id: msg.id,
    raw_content: msg.raw_content,
    channel: msg.channel,
    sender: msg.sender,
    message_ts: msg.message_ts,
    sentiment: msg.sentiment,
    processed: msg.processed,
    todo_id: msg.todo_id,
    goal_id: msg.goal_id,
    enrichment_status: msg.enrichment_status,
    created_at: msg.created_at,
    updated_at: msg.updated_at,
  };
}

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
      if (typeof args.raw_content !== 'string') {
        throw new Error('raw_content must be a string');
      }
      const channel = typeof args.channel === 'string' ? args.channel : undefined;
      const sender = typeof args.sender === 'string' ? args.sender : undefined;
      const messageTs = typeof args.message_ts === 'string' ? args.message_ts : undefined;
      const msg = SlackService.ingest(db, args.raw_content, channel, sender, messageTs);
      return slackMessageToToolResult(msg);
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
      page: z.number().optional().describe('Page number'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters: SlackFilters = {
        ...(typeof args.channel === 'string' ? { channel: args.channel } : {}),
        ...(typeof args.processed === 'number' ? { processed: args.processed } : {}),
        ...(typeof args.sentiment === 'string' && isSlackSentiment(args.sentiment)
          ? { sentiment: args.sentiment }
          : {}),
      };
      const page = typeof args.page === 'number' ? args.page : 1;
      const result = SlackService.list(db, filters, { page, pageSize: 20 });
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: result.data.map(slackMessageToToolResult),
      };
    },
  },
  {
    name: 'rmbr_slack_get',
    description: 'Get a single Slack message by ID',
    schema: {
      id: z.number().describe('The message ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      if (typeof args.id !== 'number') {
        throw new Error('id must be a number');
      }
      const msg = SlackService.getById(db, args.id);
      return slackMessageToToolResult(msg);
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
      if (typeof args.id !== 'number') {
        throw new Error('id must be a number');
      }
      if (typeof args.sentiment !== 'string' || !isSlackSentiment(args.sentiment)) {
        throw new Error('sentiment must be positive, negative, or neutral');
      }
      const msg = SlackService.setSentiment(db, args.id, args.sentiment);
      return slackMessageToToolResult(msg);
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
      if (typeof args.id !== 'number') {
        throw new Error('id must be a number');
      }
      if (typeof args.todo_id !== 'number') {
        throw new Error('todo_id must be a number');
      }
      const msg = SlackService.linkTodo(db, args.id, args.todo_id);
      return slackMessageToToolResult(msg);
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
      if (typeof args.id !== 'number') {
        throw new Error('id must be a number');
      }
      if (typeof args.goal_id !== 'number') {
        throw new Error('goal_id must be a number');
      }
      const msg = SlackService.linkGoal(db, args.id, args.goal_id);
      return slackMessageToToolResult(msg);
    },
  },
  {
    name: 'rmbr_slack_mark_processed',
    description: 'Mark a Slack message as processed',
    schema: {
      id: z.number().describe('The message ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      if (typeof args.id !== 'number') {
        throw new Error('id must be a number');
      }
      const msg = SlackService.markProcessed(db, args.id);
      return slackMessageToToolResult(msg);
    },
  },
];
