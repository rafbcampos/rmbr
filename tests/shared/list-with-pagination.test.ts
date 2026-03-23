import { describe, it, expect, beforeEach } from 'bun:test';
import { eq, desc, type SQL } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../src/core/drizzle.ts';
import { createTestDb } from '../helpers/db.ts';
import { todoMigrations } from '../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../src/modules/goals/schema.ts';
import { todos } from '../../src/modules/todo/drizzle-schema.ts';
import { todoRowToEntity } from '../../src/modules/todo/types.ts';
import { TodoStatus } from '../../src/core/types.ts';
import { listWithPagination } from '../../src/shared/list-with-pagination.ts';
import { insertGoal, insertTodo } from '../helpers/fixtures.ts';

describe('listWithPagination', () => {
  let db: DrizzleDatabase;

  const todoListConfig = {
    from: todos,
    orderBy: desc(todos.id),
    toEntity: todoRowToEntity,
  };

  beforeEach(() => {
    db = createTestDb([...goalsMigrations, ...todoMigrations]);
  });

  it('returns empty paginated result for empty table', () => {
    const result = listWithPagination(db, todoListConfig, []);
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it('applies default pagination when not provided', () => {
    for (let i = 0; i < 3; i++) {
      insertTodo(db, { raw_input: `Todo ${i}` });
    }

    const result = listWithPagination(db, todoListConfig, []);
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('paginates results across pages', () => {
    for (let i = 0; i < 5; i++) {
      insertTodo(db, { raw_input: `Todo ${i}` });
    }

    const page1 = listWithPagination(db, todoListConfig, [], { page: 1, pageSize: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);
    expect(page1.page).toBe(1);

    const page2 = listWithPagination(db, todoListConfig, [], { page: 2, pageSize: 2 });
    expect(page2.data).toHaveLength(2);
    expect(page2.page).toBe(2);

    const page3 = listWithPagination(db, todoListConfig, [], { page: 3, pageSize: 2 });
    expect(page3.data).toHaveLength(1);
    expect(page3.page).toBe(3);
  });

  it('filters correctly with conditions', () => {
    insertTodo(db, { raw_input: 'Sketch todo', status: TodoStatus.Sketch });
    insertTodo(db, { raw_input: 'Ready todo', status: TodoStatus.Ready });
    insertTodo(db, { raw_input: 'Done todo', status: TodoStatus.Done });

    const conditions: SQL[] = [eq(todos.status, TodoStatus.Sketch)];
    const result = listWithPagination(db, todoListConfig, conditions);
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.raw_input).toBe('Sketch todo');
  });

  it('combines multiple conditions', () => {
    const goalId = insertGoal(db, { raw_input: 'Test goal' });
    insertTodo(db, { raw_input: 'Sketch no goal', status: TodoStatus.Sketch });
    insertTodo(db, { raw_input: 'Sketch with goal', status: TodoStatus.Sketch, goal_id: goalId });
    insertTodo(db, { raw_input: 'Ready with goal', status: TodoStatus.Ready, goal_id: goalId });

    const conditions: SQL[] = [eq(todos.status, TodoStatus.Sketch), eq(todos.goal_id, goalId)];
    const result = listWithPagination(db, todoListConfig, conditions);
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.raw_input).toBe('Sketch with goal');
  });

  it('respects ordering', () => {
    insertTodo(db, { raw_input: 'First' });
    insertTodo(db, { raw_input: 'Second' });
    insertTodo(db, { raw_input: 'Third' });

    const result = listWithPagination(db, todoListConfig, []);
    expect(result.data[0]?.raw_input).toBe('Third');
    expect(result.data[1]?.raw_input).toBe('Second');
    expect(result.data[2]?.raw_input).toBe('First');
  });
});
