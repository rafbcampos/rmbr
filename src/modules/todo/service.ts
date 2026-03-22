import { eq, sql, count, desc, and, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { PaginatedResult, PaginationParams } from '../../core/types.ts';
import { TodoStatus, EnrichmentStatus } from '../../core/types.ts';
import { NotFoundError, InvalidTransitionError } from '../../core/errors.ts';
import { paginateResults, DEFAULT_PAGINATION } from '../../shared/pagination.ts';
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
  readonly status?: TodoStatus;
  readonly goalId?: number;
}

export function create(db: DrizzleDatabase, rawInput: string): Todo {
  const result = db.insert(todos).values({ raw_input: rawInput }).returning().get();
  return todoRowToEntity(result);
}

export function list(
  db: DrizzleDatabase,
  filters?: TodoFilters,
  pagination?: PaginationParams,
): PaginatedResult<Todo> {
  const pag = pagination ?? DEFAULT_PAGINATION;
  const conditions: SQL[] = [];

  if (filters?.status !== undefined) {
    conditions.push(eq(todos.status, filters.status));
  }
  if (filters?.goalId !== undefined) {
    conditions.push(eq(todos.goal_id, filters.goalId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const total = db.select({ value: count() }).from(todos).where(whereClause).get()?.value ?? 0;

  const offset = (pag.page - 1) * pag.pageSize;
  const rows = db
    .select()
    .from(todos)
    .where(whereClause)
    .orderBy(desc(todos.id))
    .limit(pag.pageSize)
    .offset(offset)
    .all();

  return paginateResults({ data: rows.map(todoRowToEntity), total }, pag);
}

export function getById(db: DrizzleDatabase, id: number): Todo {
  const row = db.select().from(todos).where(eq(todos.id, id)).get();
  if (!row) {
    throw new NotFoundError('todo', id);
  }
  return todoRowToEntity(row);
}

export function transition(db: DrizzleDatabase, id: number, newStatus: TodoStatus): Todo {
  const todo = getById(db, id);
  const allowed = VALID_TRANSITIONS[todo.status];

  if (!allowed.includes(newStatus)) {
    throw new InvalidTransitionError('todo', todo.status, newStatus);
  }

  db.update(todos)
    .set({ status: newStatus, updated_at: sql`datetime('now')` })
    .where(eq(todos.id, id))
    .run();

  return getById(db, id);
}

export interface EnrichFields {
  readonly title?: string | undefined;
  readonly priority?: string | undefined;
  readonly due_date?: string | undefined;
  readonly goal_id?: number | undefined;
}

export function enrich(db: DrizzleDatabase, id: number, fields: EnrichFields): Todo {
  const todo = getById(db, id);

  const updates: Record<string, string | number> = {
    enrichment_status: EnrichmentStatus.Enriched,
  };

  if (fields.title !== undefined) {
    updates['title'] = fields.title;
  }
  if (fields.priority !== undefined) {
    updates['priority'] = fields.priority;
  }
  if (fields.due_date !== undefined) {
    updates['due_date'] = fields.due_date;
  }
  if (fields.goal_id !== undefined) {
    updates['goal_id'] = fields.goal_id;
  }

  db.update(todos)
    .set({ ...updates, updated_at: sql`datetime('now')` })
    .where(eq(todos.id, id))
    .run();

  if (todo.status === TodoStatus.Sketch) {
    db.update(todos)
      .set({ status: TodoStatus.Ready, updated_at: sql`datetime('now')` })
      .where(eq(todos.id, id))
      .run();
  }

  return getById(db, id);
}
