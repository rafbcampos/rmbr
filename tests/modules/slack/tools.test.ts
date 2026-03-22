import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertSlackMessage, insertTodo, insertGoal } from '../../helpers/fixtures.ts';
import { slackMigrations } from '../../../src/modules/slack/schema.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { slackTools } from '../../../src/modules/slack/tools.ts';
import { EnrichmentStatus, SlackSentiment } from '../../../src/core/types.ts';
import type { McpToolDefinition } from '../../../src/core/module-contract.ts';

function findTool(name: string): McpToolDefinition {
  const tool = slackTools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function createSlackTestDb(): DrizzleDatabase {
  return createTestDb([...goalsMigrations, ...todoMigrations, ...slackMigrations]);
}

describe('slack tools', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createSlackTestDb();
  });

  describe('rmbr_slack_ingest', () => {
    const tool = findTool('rmbr_slack_ingest');

    it('ingests a message with raw_content only', async () => {
      const result = await tool.handler(db, { raw_content: 'Hello from Slack' });
      expect(result.id).toBe(1);
      expect(result.raw_content).toBe('Hello from Slack');
      expect(result.channel).toBeNull();
      expect(result.sender).toBeNull();
      expect(result.message_ts).toBeNull();
      expect(result.sentiment).toBeNull();
      expect(result.processed).toBe(0);
      expect(result.todo_id).toBeNull();
      expect(result.goal_id).toBeNull();
      expect(result.enrichment_status).toBe(EnrichmentStatus.Raw);
    });

    it('ingests a message with channel, sender, and message_ts', async () => {
      const result = await tool.handler(db, {
        raw_content: 'Channel message',
        channel: '#general',
        sender: 'alice',
        message_ts: '1234567890.123',
      });
      expect(result.raw_content).toBe('Channel message');
      expect(result.channel).toBe('#general');
      expect(result.sender).toBe('alice');
      expect(result.message_ts).toBe('1234567890.123');
    });

    it('throws when raw_content is missing', async () => {
      await expect(tool.handler(db, {})).rejects.toThrow();
    });
  });

  describe('rmbr_slack_list', () => {
    const tool = findTool('rmbr_slack_list');

    it('returns all messages when no filters provided', async () => {
      insertSlackMessage(db, { raw_content: 'First' });
      insertSlackMessage(db, { raw_content: 'Second' });

      const result = await tool.handler(db, {});
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
    });

    it('returns empty result when no messages exist', async () => {
      const result = await tool.handler(db, {});
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('filters by channel', async () => {
      insertSlackMessage(db, { raw_content: 'Gen msg', channel: '#general' });
      insertSlackMessage(db, { raw_content: 'Dev msg', channel: '#dev' });
      insertSlackMessage(db, { raw_content: 'Gen msg 2', channel: '#general' });

      const result = await tool.handler(db, { channel: '#general' });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('filters by processed status', async () => {
      insertSlackMessage(db, { raw_content: 'Unprocessed' });
      insertSlackMessage(db, { raw_content: 'Processed', processed: 1 });

      const unprocessed = await tool.handler(db, { processed: 0 });
      expect(unprocessed.total).toBe(1);

      const processed = await tool.handler(db, { processed: 1 });
      expect(processed.total).toBe(1);
    });

    it('paginates results', async () => {
      for (let i = 0; i < 25; i++) {
        insertSlackMessage(db, { raw_content: `Message ${i}` });
      }

      const page1 = await tool.handler(db, {});
      expect(page1.data).toHaveLength(20);
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(2);
      expect(page1.page).toBe(1);

      const page2 = await tool.handler(db, { page: 2 });
      expect(page2.data).toHaveLength(5);
      expect(page2.page).toBe(2);
    });
  });

  describe('rmbr_slack_get', () => {
    const tool = findTool('rmbr_slack_get');

    it('returns a message by id', async () => {
      const msgId = insertSlackMessage(db, {
        raw_content: 'Test message',
        channel: '#general',
        sender: 'bob',
      });

      const result = await tool.handler(db, { id: msgId });
      expect(result.id).toBe(msgId);
      expect(result.raw_content).toBe('Test message');
      expect(result.channel).toBe('#general');
      expect(result.sender).toBe('bob');
    });

    it('throws for non-existent id', async () => {
      await expect(tool.handler(db, { id: 999 })).rejects.toThrow();
    });

    it('throws when id is missing', async () => {
      await expect(tool.handler(db, {})).rejects.toThrow();
    });
  });

  describe('rmbr_slack_set_sentiment', () => {
    const tool = findTool('rmbr_slack_set_sentiment');

    it('sets sentiment on a message', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Good news' });

      const result = await tool.handler(db, {
        id: msgId,
        sentiment: SlackSentiment.Positive,
      });
      expect(result.sentiment).toBe(SlackSentiment.Positive);
    });

    it('changes sentiment to a different value', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Some message' });

      await tool.handler(db, { id: msgId, sentiment: SlackSentiment.Positive });
      const result = await tool.handler(db, { id: msgId, sentiment: SlackSentiment.Negative });
      expect(result.sentiment).toBe(SlackSentiment.Negative);
    });

    it('sets neutral sentiment', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Meh' });

      const result = await tool.handler(db, {
        id: msgId,
        sentiment: SlackSentiment.Neutral,
      });
      expect(result.sentiment).toBe(SlackSentiment.Neutral);
    });

    it('throws for non-existent message', async () => {
      await expect(
        tool.handler(db, { id: 999, sentiment: SlackSentiment.Positive }),
      ).rejects.toThrow();
    });

    it('throws for invalid sentiment', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Test' });
      await expect(tool.handler(db, { id: msgId, sentiment: 'invalid' })).rejects.toThrow();
    });
  });

  describe('rmbr_slack_mark_processed', () => {
    const tool = findTool('rmbr_slack_mark_processed');

    it('marks a message as processed', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Unprocessed' });

      const result = await tool.handler(db, { id: msgId });
      expect(result.processed).toBe(1);
    });

    it('throws for non-existent message', async () => {
      await expect(tool.handler(db, { id: 999 })).rejects.toThrow();
    });
  });

  describe('rmbr_slack_link_todo', () => {
    const tool = findTool('rmbr_slack_link_todo');

    it('links a slack message to a todo', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Related to task' });
      const todoId = insertTodo(db, { raw_input: 'Fix bug' });

      const result = await tool.handler(db, { id: msgId, todo_id: todoId });
      expect(result.todo_id).toBe(todoId);
    });

    it('throws for non-existent message', async () => {
      const todoId = insertTodo(db, { raw_input: 'Fix bug' });
      await expect(tool.handler(db, { id: 999, todo_id: todoId })).rejects.toThrow();
    });

    it('throws when id is missing', async () => {
      await expect(tool.handler(db, { todo_id: 1 })).rejects.toThrow();
    });

    it('throws when todo_id is missing', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Test' });
      await expect(tool.handler(db, { id: msgId })).rejects.toThrow();
    });
  });

  describe('rmbr_slack_link_goal', () => {
    const tool = findTool('rmbr_slack_link_goal');

    it('links a slack message to a goal', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Goal-related update' });
      const goalId = insertGoal(db, { raw_input: 'Ship v2' });

      const result = await tool.handler(db, { id: msgId, goal_id: goalId });
      expect(result.goal_id).toBe(goalId);
    });

    it('throws for non-existent message', async () => {
      const goalId = insertGoal(db, { raw_input: 'Ship v2' });
      await expect(tool.handler(db, { id: 999, goal_id: goalId })).rejects.toThrow();
    });

    it('throws when id is missing', async () => {
      await expect(tool.handler(db, { goal_id: 1 })).rejects.toThrow();
    });

    it('throws when goal_id is missing', async () => {
      const msgId = insertSlackMessage(db, { raw_content: 'Test' });
      await expect(tool.handler(db, { id: msgId })).rejects.toThrow();
    });
  });
});
