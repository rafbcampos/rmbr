import { eq, sql, desc, notInArray, isNotNull, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../../core/types.ts';
import { TodoStatus } from '../../core/types.ts';
import { NotFoundError } from '../../core/errors.ts';
import { enrichEntity, toUpdateRecord } from '../../shared/enrichment.ts';
import { listWithPagination } from '../../shared/list-with-pagination.ts';
import { softDelete, restore, notDeletedCondition } from '../../shared/soft-delete.ts';
import { handleTransition } from '../../shared/transition.ts';
import type { Todo } from './types.ts';
import { todoRowToEntity } from './types.ts';
import { todos } from './drizzle-schema.ts';

const VALID_TRANSITIONS: Record<TodoStatus, readonly TodoStatus[]> = {
  [TodoStatus.Sketch]: [TodoStatus.Ready, TodoStatus.Cancelled],
  [TodoStatus.Ready]: [TodoStatus.InProgress, TodoStatus.Cancelled],
  [TodoStatus.InProgress]: [TodoStatus.Paused, TodoStatus.Done, TodoStatus.Cancelled],
  [TodoStatus.Paused]: [TodoStatus.InProgress, TodoStatus.Cancelled],
  [TodoStatus.Done]: [],
  [TodoStatus.Cancelled]: [],
};

export interface TodoFilters {
  readonly status?: TodoStatus | undefined;
  readonly goalId?: number | undefined;
  readonly overdue?: boolean | undefined;
  readonly dueToday?: boolean | undefined;
  readonly dueThisWeek?: boolean | undefined;
  readonly includeDeleted?: boolean | undefined;
}

export interface EnrichFields {
  readonly title?: string | undefined;
  readonly priority?: string | undefined;
  readonly due_date?: string | undefined;
  readonly goal_id?: number | undefined;
}

export const TodoService = {
  create(db: DrizzleDatabase, rawInput: string): Todo {
    const result = db.insert(todos).values({ raw_input: rawInput }).returning().get();
    return todoRowToEntity(result);
  },

  list(
    db: DrizzleDatabase,
    filters?: TodoFilters,
    pagination?: PaginationParams,
  ): PaginatedResult<Todo> {
    const conditions: SQL[] = [];

    if (filters?.includeDeleted !== true) {
      conditions.push(notDeletedCondition(todos.deleted_at));
    }

    if (filters?.status !== undefined) {
      conditions.push(eq(todos.status, filters.status));
    }
    if (filters?.goalId !== undefined) {
      conditions.push(eq(todos.goal_id, filters.goalId));
    }
    if (filters?.overdue === true) {
      conditions.push(isNotNull(todos.due_date));
      conditions.push(sql`${todos.due_date} < date('now')`);
      conditions.push(notInArray(todos.status, [TodoStatus.Done, TodoStatus.Cancelled]));
    }
    if (filters?.dueToday === true) {
      conditions.push(sql`${todos.due_date} = date('now')`);
    }
    if (filters?.dueThisWeek === true) {
      conditions.push(isNotNull(todos.due_date));
      conditions.push(sql`${todos.due_date} >= date('now', 'weekday 1', '-7 days')`);
      conditions.push(sql`${todos.due_date} < date('now', 'weekday 1')`);
    }

    return listWithPagination(
      db,
      { from: todos, orderBy: desc(todos.id), toEntity: todoRowToEntity },
      conditions,
      pagination,
    );
  },

  getById(db: DrizzleDatabase, id: number): Todo {
    const row = db.select().from(todos).where(eq(todos.id, id)).get();
    if (!row) {
      throw new NotFoundError('todo', id);
    }
    return todoRowToEntity(row);
  },

  transition(db: DrizzleDatabase, id: number, newStatus: TodoStatus): Todo {
    const todo = TodoService.getById(db, id);
    handleTransition(
      db,
      { table: todos, entityName: 'todo', validTransitions: VALID_TRANSITIONS },
      todo.id,
      todo.status,
      newStatus,
    );
    return TodoService.getById(db, id);
  },

  enrich(db: DrizzleDatabase, id: number, fields: EnrichFields): Todo {
    const todo = TodoService.getById(db, id);

    enrichEntity(db, todos, 'todos', id, toUpdateRecord(fields));

    if (todo.status === TodoStatus.Sketch) {
      db.update(todos)
        .set({ status: TodoStatus.Ready, updated_at: sql`datetime('now')` })
        .where(eq(todos.id, id))
        .run();
    }

    return TodoService.getById(db, id);
  },

  softDeleteEntity(db: DrizzleDatabase, id: number): void {
    softDelete(db, todos, 'todo', id);
  },

  restoreEntity(db: DrizzleDatabase, id: number): void {
    restore(db, todos, 'todo', id);
  },
};
