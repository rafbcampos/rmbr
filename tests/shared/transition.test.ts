import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../src/core/drizzle.ts';
import { createTestDb } from '../helpers/db.ts';
import { todoMigrations } from '../../src/modules/todo/schema.ts';
import { goalsMigrations } from '../../src/modules/goals/schema.ts';
import { handleTransition } from '../../src/shared/transition.ts';
import { InvalidTransitionError, NotFoundError } from '../../src/core/errors.ts';
import { TodoStatus } from '../../src/core/types.ts';
import { todos } from '../../src/modules/todo/drizzle-schema.ts';
import { insertTodo } from '../helpers/fixtures.ts';
import { TodoService } from '../../src/modules/todo/service.ts';

const VALID_TRANSITIONS: Record<TodoStatus, readonly TodoStatus[]> = {
  [TodoStatus.Sketch]: [TodoStatus.Ready, TodoStatus.Cancelled],
  [TodoStatus.Ready]: [TodoStatus.InProgress, TodoStatus.Cancelled],
  [TodoStatus.InProgress]: [TodoStatus.Paused, TodoStatus.Done, TodoStatus.Cancelled],
  [TodoStatus.Paused]: [TodoStatus.InProgress, TodoStatus.Cancelled],
  [TodoStatus.Done]: [],
  [TodoStatus.Cancelled]: [],
};

const TODO_CONFIG = {
  table: todos,
  entityName: 'todo',
  validTransitions: VALID_TRANSITIONS,
};

describe('handleTransition', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalsMigrations, ...todoMigrations]);
  });

  it('succeeds for a valid transition and updates status', () => {
    const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Sketch });
    handleTransition(db, TODO_CONFIG, id, TodoStatus.Sketch, TodoStatus.Ready);

    const updated = TodoService.getById(db, id);
    expect(updated.status).toBe(TodoStatus.Ready);
  });

  it('throws InvalidTransitionError for an invalid transition', () => {
    const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Done });
    expect(() =>
      handleTransition(db, TODO_CONFIG, id, TodoStatus.Done, TodoStatus.InProgress),
    ).toThrow(InvalidTransitionError);
  });

  it('throws NotFoundError for a non-existent entity via the module getById', () => {
    expect(() => TodoService.transition(db, 999, TodoStatus.Ready)).toThrow(NotFoundError);
  });

  it('sets updated_at to a valid datetime string', () => {
    const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Ready });
    handleTransition(db, TODO_CONFIG, id, TodoStatus.Ready, TodoStatus.InProgress);
    const after = TodoService.getById(db, id);

    expect(after.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('includes entity name in error message', () => {
    const id = insertTodo(db, { raw_input: 'Test', status: TodoStatus.Done });
    expect(() => handleTransition(db, TODO_CONFIG, id, TodoStatus.Done, TodoStatus.Sketch)).toThrow(
      /todo/,
    );
  });
});
