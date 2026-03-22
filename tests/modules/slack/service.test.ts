import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { insertSlackMessage, insertTodo, insertGoal } from '../../helpers/fixtures.ts';
import { slackMigrations } from '../../../src/modules/slack/schema.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../../src/modules/goals/schema.ts';
import { SlackService } from '../../../src/modules/slack/service.ts';
import { NotFoundError } from '../../../src/core/errors.ts';
import { EnrichmentStatus, SlackSentiment } from '../../../src/core/types.ts';

function createSlackTestDb(): DrizzleDatabase {
  return createTestDb([...goalsMigrations, ...todoMigrations, ...slackMigrations]);
}

describe('SlackService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createSlackTestDb();
  });

  describe('ingest', () => {
    it('creates a slack message with raw content', () => {
      const msg = SlackService.ingest(db, 'Hello from Slack');
      expect(msg.id).toBe(1);
      expect(msg.raw_content).toBe('Hello from Slack');
      expect(msg.channel).toBeNull();
      expect(msg.sender).toBeNull();
      expect(msg.message_ts).toBeNull();
      expect(msg.sentiment).toBeNull();
      expect(msg.processed).toBe(0);
      expect(msg.todo_id).toBeNull();
      expect(msg.goal_id).toBeNull();
      expect(msg.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(msg.created_at).toBeDefined();
      expect(msg.updated_at).toBeDefined();
    });

    it('creates a slack message with all optional fields', () => {
      const msg = SlackService.ingest(db, 'Channel message', '#general', 'alice', '1234567890.123');
      expect(msg.raw_content).toBe('Channel message');
      expect(msg.channel).toBe('#general');
      expect(msg.sender).toBe('alice');
      expect(msg.message_ts).toBe('1234567890.123');
    });

    it('auto-increments ids', () => {
      const first = SlackService.ingest(db, 'First');
      const second = SlackService.ingest(db, 'Second');
      expect(second.id).toBe(first.id + 1);
    });
  });

  describe('getById', () => {
    it('returns a slack message by id', () => {
      const created = SlackService.ingest(db, 'Test message');
      const fetched = SlackService.getById(db, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.raw_content).toBe('Test message');
    });

    it('throws NotFoundError for non-existent id', () => {
      expect(() => SlackService.getById(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('returns empty paginated result when no messages exist', () => {
      const result = SlackService.list(db);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('returns all messages ordered by created_at desc', () => {
      insertSlackMessage(db, { raw_content: 'First' });
      insertSlackMessage(db, { raw_content: 'Second' });
      insertSlackMessage(db, { raw_content: 'Third' });

      const result = SlackService.list(db);
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('filters by channel', () => {
      insertSlackMessage(db, { raw_content: 'Gen msg', channel: '#general' });
      insertSlackMessage(db, { raw_content: 'Dev msg', channel: '#dev' });
      insertSlackMessage(db, { raw_content: 'Gen msg 2', channel: '#general' });

      const result = SlackService.list(db, { channel: '#general' });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by processed status', () => {
      insertSlackMessage(db, { raw_content: 'Unprocessed' });
      insertSlackMessage(db, { raw_content: 'Processed', processed: 1 });

      const unprocessed = SlackService.list(db, { processed: 0 });
      expect(unprocessed.data).toHaveLength(1);
      expect(unprocessed.total).toBe(1);

      const processed = SlackService.list(db, { processed: 1 });
      expect(processed.data).toHaveLength(1);
      expect(processed.total).toBe(1);
    });

    it('filters by sentiment', () => {
      insertSlackMessage(db, { raw_content: 'Good', sentiment: 'positive' });
      insertSlackMessage(db, { raw_content: 'Bad', sentiment: 'negative' });
      insertSlackMessage(db, { raw_content: 'Meh', sentiment: 'neutral' });

      const result = SlackService.list(db, { sentiment: SlackSentiment.Positive });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('combines multiple filters', () => {
      insertSlackMessage(db, {
        raw_content: 'Match',
        channel: '#general',
        sentiment: 'positive',
      });
      insertSlackMessage(db, {
        raw_content: 'No match channel',
        channel: '#dev',
        sentiment: 'positive',
      });
      insertSlackMessage(db, {
        raw_content: 'No match sentiment',
        channel: '#general',
        sentiment: 'negative',
      });

      const result = SlackService.list(db, {
        channel: '#general',
        sentiment: SlackSentiment.Positive,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.raw_content).toBe('Match');
    });

    it('paginates results', () => {
      for (let i = 0; i < 5; i++) {
        insertSlackMessage(db, { raw_content: `Message ${i}` });
      }

      const page1 = SlackService.list(db, {}, { page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);

      const page2 = SlackService.list(db, {}, { page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(2);

      const page3 = SlackService.list(db, {}, { page: 3, pageSize: 2 });
      expect(page3.data).toHaveLength(1);
    });
  });

  describe('setSentiment', () => {
    it('sets sentiment on a message', () => {
      const created = SlackService.ingest(db, 'Some message');
      const updated = SlackService.setSentiment(db, created.id, SlackSentiment.Positive);
      expect(updated.sentiment).toBe(SlackSentiment.Positive);
    });

    it('changes sentiment', () => {
      const created = SlackService.ingest(db, 'Some message');
      SlackService.setSentiment(db, created.id, SlackSentiment.Positive);
      const updated = SlackService.setSentiment(db, created.id, SlackSentiment.Negative);
      expect(updated.sentiment).toBe(SlackSentiment.Negative);
    });

    it('throws NotFoundError for non-existent id', () => {
      expect(() => SlackService.setSentiment(db, 999, SlackSentiment.Positive)).toThrow(
        NotFoundError,
      );
    });
  });

  describe('linkTodo', () => {
    it('links a message to a todo', () => {
      const todoId = insertTodo(db, { raw_input: 'Test todo' });
      const created = SlackService.ingest(db, 'Related message');
      const updated = SlackService.linkTodo(db, created.id, todoId);
      expect(updated.todo_id).toBe(todoId);
    });

    it('throws NotFoundError for non-existent message', () => {
      expect(() => SlackService.linkTodo(db, 999, 1)).toThrow(NotFoundError);
    });
  });

  describe('linkGoal', () => {
    it('links a message to a goal', () => {
      const goalId = insertGoal(db, { raw_input: 'Test goal' });
      const created = SlackService.ingest(db, 'Related message');
      const updated = SlackService.linkGoal(db, created.id, goalId);
      expect(updated.goal_id).toBe(goalId);
    });

    it('throws NotFoundError for non-existent message', () => {
      expect(() => SlackService.linkGoal(db, 999, 1)).toThrow(NotFoundError);
    });
  });

  describe('markProcessed', () => {
    it('marks a message as processed', () => {
      const created = SlackService.ingest(db, 'Unprocessed message');
      expect(created.processed).toBe(0);
      const updated = SlackService.markProcessed(db, created.id);
      expect(updated.processed).toBe(1);
    });

    it('throws NotFoundError for non-existent id', () => {
      expect(() => SlackService.markProcessed(db, 999)).toThrow(NotFoundError);
    });

    it('updates the updated_at timestamp', () => {
      const created = SlackService.ingest(db, 'Test message');
      const updated = SlackService.markProcessed(db, created.id);
      expect(updated.updated_at).toBeDefined();
    });
  });
});
