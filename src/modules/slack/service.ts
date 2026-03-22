import { eq, sql, count, desc, and, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams, SlackSentiment } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { DEFAULT_PAGINATION, paginateResults } from '../../shared/pagination.ts';
import type { SlackMessage } from './types.ts';
import { toSlackMessage } from './types.ts';
import { slackMessages } from './drizzle-schema.ts';

export interface SlackFilters {
  readonly channel?: string;
  readonly processed?: number;
  readonly sentiment?: SlackSentiment;
}

export const SlackService = {
  ingest(
    db: DrizzleDatabase,
    rawContent: string,
    channel?: string,
    sender?: string,
    messageTs?: string,
  ): SlackMessage {
    const row = db
      .insert(slackMessages)
      .values({
        raw_input: rawContent,
        raw_content: rawContent,
        channel: channel ?? null,
        sender: sender ?? null,
        message_ts: messageTs ?? null,
      })
      .returning()
      .get();
    return toSlackMessage(row);
  },

  list(
    db: DrizzleDatabase,
    filters: SlackFilters = {},
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): PaginatedResult<SlackMessage> {
    const conditions: SQL[] = [];

    if (filters.channel !== undefined) {
      conditions.push(eq(slackMessages.channel, filters.channel));
    }
    if (filters.processed !== undefined) {
      conditions.push(eq(slackMessages.processed, filters.processed));
    }
    if (filters.sentiment !== undefined) {
      conditions.push(eq(slackMessages.sentiment, filters.sentiment));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total =
      db.select({ value: count() }).from(slackMessages).where(whereClause).get()?.value ?? 0;

    const offset = (pagination.page - 1) * pagination.pageSize;
    const rows = db
      .select()
      .from(slackMessages)
      .where(whereClause)
      .orderBy(desc(slackMessages.created_at))
      .limit(pagination.pageSize)
      .offset(offset)
      .all();

    return paginateResults({ data: rows.map(toSlackMessage), total }, pagination);
  },

  getById(db: DrizzleDatabase, id: number): SlackMessage {
    const row = db.select().from(slackMessages).where(eq(slackMessages.id, id)).get();
    if (!row) {
      throw new NotFoundError('slack_messages', id);
    }
    return toSlackMessage(row);
  },

  setSentiment(db: DrizzleDatabase, id: number, sentiment: SlackSentiment): SlackMessage {
    SlackService.getById(db, id);
    db.update(slackMessages)
      .set({ sentiment, updated_at: sql`datetime('now')` })
      .where(eq(slackMessages.id, id))
      .run();
    return SlackService.getById(db, id);
  },

  linkTodo(db: DrizzleDatabase, id: number, todoId: number): SlackMessage {
    SlackService.getById(db, id);
    db.update(slackMessages)
      .set({ todo_id: todoId, updated_at: sql`datetime('now')` })
      .where(eq(slackMessages.id, id))
      .run();
    return SlackService.getById(db, id);
  },

  linkGoal(db: DrizzleDatabase, id: number, goalId: number): SlackMessage {
    SlackService.getById(db, id);
    db.update(slackMessages)
      .set({ goal_id: goalId, updated_at: sql`datetime('now')` })
      .where(eq(slackMessages.id, id))
      .run();
    return SlackService.getById(db, id);
  },

  markProcessed(db: DrizzleDatabase, id: number): SlackMessage {
    SlackService.getById(db, id);
    db.update(slackMessages)
      .set({ processed: 1, updated_at: sql`datetime('now')` })
      .where(eq(slackMessages.id, id))
      .run();
    return SlackService.getById(db, id);
  },
};
