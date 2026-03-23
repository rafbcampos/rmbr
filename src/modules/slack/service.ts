import { eq, sql, desc, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams, SlackSentiment } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { listWithPagination } from '../../shared/list-with-pagination.ts';
import { softDelete, restore, notDeletedCondition } from '../../shared/soft-delete.ts';
import type { SlackMessage } from './types.ts';
import { toSlackMessage } from './types.ts';
import { slackMessages } from './drizzle-schema.ts';

export interface SlackFilters {
  readonly channel?: string | undefined;
  readonly processed?: number | undefined;
  readonly sentiment?: SlackSentiment | undefined;
  readonly includeDeleted?: boolean | undefined;
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
    pagination?: PaginationParams,
  ): PaginatedResult<SlackMessage> {
    const conditions: SQL[] = [];

    if (filters.includeDeleted !== true) {
      conditions.push(notDeletedCondition(slackMessages.deleted_at));
    }

    if (filters.channel !== undefined) {
      conditions.push(eq(slackMessages.channel, filters.channel));
    }
    if (filters.processed !== undefined) {
      conditions.push(eq(slackMessages.processed, filters.processed));
    }
    if (filters.sentiment !== undefined) {
      conditions.push(eq(slackMessages.sentiment, filters.sentiment));
    }

    return listWithPagination(
      db,
      { from: slackMessages, orderBy: desc(slackMessages.created_at), toEntity: toSlackMessage },
      conditions,
      pagination,
    );
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

  softDeleteEntity(db: DrizzleDatabase, id: number): void {
    softDelete(db, slackMessages, 'slack_messages', id);
  },

  restoreEntity(db: DrizzleDatabase, id: number): void {
    restore(db, slackMessages, 'slack_messages', id);
  },
};
