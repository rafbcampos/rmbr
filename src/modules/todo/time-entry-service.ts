import { eq, sql, isNull, and, desc } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { ValidationError } from '../../core/errors.ts';
import { TodoStatus } from '../../core/types.ts';
import type { TimeEntry, TodoRow, TodoWithTime } from './types.ts';
import { timeEntryRowToEntity, todoRowToEntity } from './types.ts';
import { todoTimeEntries } from './drizzle-schema.ts';
import { todos } from './drizzle-schema.ts';

export interface CompletedDurationFilters {
  readonly goalId?: number | undefined;
  readonly priority?: string | undefined;
  readonly limit?: number | undefined;
}

export const TimeEntryService = {
  start(db: DrizzleDatabase, todoId: number): TimeEntry {
    const existing = db
      .select()
      .from(todoTimeEntries)
      .where(and(eq(todoTimeEntries.todo_id, todoId), isNull(todoTimeEntries.stopped_at)))
      .get();

    if (existing) {
      throw new ValidationError(`Todo #${todoId} already has an active timer`);
    }

    const row = db.insert(todoTimeEntries).values({ todo_id: todoId }).returning().get();

    return timeEntryRowToEntity(row);
  },

  stop(db: DrizzleDatabase, todoId: number): TimeEntry {
    const active = db
      .select()
      .from(todoTimeEntries)
      .where(and(eq(todoTimeEntries.todo_id, todoId), isNull(todoTimeEntries.stopped_at)))
      .get();

    if (!active) {
      throw new ValidationError(`No active timer for todo #${todoId}`);
    }

    db.update(todoTimeEntries)
      .set({ stopped_at: sql`datetime('now')` })
      .where(eq(todoTimeEntries.id, active.id))
      .run();

    const updated = db
      .select()
      .from(todoTimeEntries)
      .where(eq(todoTimeEntries.id, active.id))
      .get();

    if (!updated) {
      throw new ValidationError(`Failed to retrieve stopped time entry #${active.id}`);
    }

    return timeEntryRowToEntity(updated);
  },

  stopAll(db: DrizzleDatabase): number {
    const running = db
      .select({ id: todoTimeEntries.id })
      .from(todoTimeEntries)
      .where(isNull(todoTimeEntries.stopped_at))
      .all();

    if (running.length === 0) return 0;

    db.update(todoTimeEntries)
      .set({ stopped_at: sql`datetime('now')` })
      .where(isNull(todoTimeEntries.stopped_at))
      .run();

    return running.length;
  },

  getActive(db: DrizzleDatabase, todoId: number): TimeEntry | null {
    const row = db
      .select()
      .from(todoTimeEntries)
      .where(and(eq(todoTimeEntries.todo_id, todoId), isNull(todoTimeEntries.stopped_at)))
      .get();

    if (!row) return null;
    return timeEntryRowToEntity(row);
  },

  getAnyActive(db: DrizzleDatabase): TimeEntry | null {
    const row = db
      .select()
      .from(todoTimeEntries)
      .where(isNull(todoTimeEntries.stopped_at))
      .limit(1)
      .get();

    if (!row) return null;
    return timeEntryRowToEntity(row);
  },

  getRunningCount(db: DrizzleDatabase): number {
    const result = db
      .select({ count: sql<number>`COUNT(DISTINCT ${todoTimeEntries.todo_id})` })
      .from(todoTimeEntries)
      .where(isNull(todoTimeEntries.stopped_at))
      .get();

    return result?.count ?? 0;
  },

  listForTodo(db: DrizzleDatabase, todoId: number): readonly TimeEntry[] {
    const rows = db
      .select()
      .from(todoTimeEntries)
      .where(eq(todoTimeEntries.todo_id, todoId))
      .orderBy(desc(todoTimeEntries.started_at))
      .all();

    return rows.map(r => timeEntryRowToEntity(r));
  },

  totalElapsed(db: DrizzleDatabase, todoId: number): number {
    const result = db
      .select({
        total: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${todoTimeEntries.stopped_at} IS NOT NULL
            THEN ROUND((julianday(${todoTimeEntries.stopped_at}) - julianday(${todoTimeEntries.started_at})) * 86400)
            ELSE ROUND((julianday('now') - julianday(${todoTimeEntries.started_at})) * 86400)
          END
        ), 0)`,
      })
      .from(todoTimeEntries)
      .where(eq(todoTimeEntries.todo_id, todoId))
      .get();

    return Math.floor(result?.total ?? 0);
  },

  getCompletedWithDuration(
    db: DrizzleDatabase,
    filters?: CompletedDurationFilters,
  ): readonly TodoWithTime[] {
    const limit = filters?.limit ?? 50;

    let query = db
      .select({
        id: todos.id,
        raw_input: todos.raw_input,
        title: todos.title,
        status: todos.status,
        priority: todos.priority,
        due_date: todos.due_date,
        goal_id: todos.goal_id,
        enrichment_status: todos.enrichment_status,
        created_at: todos.created_at,
        updated_at: todos.updated_at,
        deleted_at: todos.deleted_at,
        total_elapsed_seconds: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${todoTimeEntries.stopped_at} IS NOT NULL
            THEN ROUND((julianday(${todoTimeEntries.stopped_at}) - julianday(${todoTimeEntries.started_at})) * 86400)
            ELSE 0
          END
        ), 0)`,
      })
      .from(todos)
      .leftJoin(todoTimeEntries, eq(todos.id, todoTimeEntries.todo_id))
      .where(
        and(
          eq(todos.status, TodoStatus.Done),
          isNull(todos.deleted_at),
          ...(filters?.goalId !== undefined ? [eq(todos.goal_id, filters.goalId)] : []),
          ...(filters?.priority !== undefined ? [eq(todos.priority, filters.priority)] : []),
        ),
      )
      .groupBy(todos.id)
      .orderBy(desc(todos.updated_at))
      .$dynamic();

    query = query.limit(limit);

    const rows = query.all();

    return rows.map(row => {
      const todoRow: TodoRow = {
        id: row.id,
        raw_input: row.raw_input,
        title: row.title,
        status: row.status,
        priority: row.priority,
        due_date: row.due_date,
        goal_id: row.goal_id,
        enrichment_status: row.enrichment_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      };
      const todo = todoRowToEntity(todoRow);
      return {
        ...todo,
        total_elapsed_seconds: Math.floor(row.total_elapsed_seconds),
        active_entry_id: null,
      } satisfies TodoWithTime;
    });
  },
};
