import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations as goalMigrations } from '../../../src/modules/goals/schema.ts';
import { TodoService } from '../../../src/modules/todo/service.ts';
import { NotFoundError, InvalidTransitionError } from '../../../src/core/errors.ts';
import { TodoStatus, EnrichmentStatus } from '../../../src/core/types.ts';
import { insertGoal, insertTodo } from '../../helpers/fixtures.ts';

describe('TodoService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalMigrations, ...todoMigrations]);
  });

  describe('create', () => {
    it('creates a todo with raw input', () => {
      const todo = TodoService.create(db, 'Buy groceries');
      expect(todo.id).toBe(1);
      expect(todo.raw_input).toBe('Buy groceries');
      expect(todo.status).toBe(TodoStatus.Sketch);
      expect(todo.enrichment_status).toBe(EnrichmentStatus.Raw);
      expect(todo.title).toBeNull();
      expect(todo.priority).toBeNull();
      expect(todo.due_date).toBeNull();
      expect(todo.goal_id).toBeNull();
    });

    it('creates multiple todos with incrementing ids', () => {
      const t1 = TodoService.create(db, 'First');
      const t2 = TodoService.create(db, 'Second');
      expect(t1.id).toBe(1);
      expect(t2.id).toBe(2);
    });
  });

  describe('getById', () => {
    it('returns a todo by id', () => {
      const id = insertTodo(db, { raw_input: 'Test todo' });
      const todo = TodoService.getById(db, id);
      expect(todo.id).toBe(id);
      expect(todo.raw_input).toBe('Test todo');
    });

    it('throws NotFoundError for missing todo', () => {
      expect(() => TodoService.getById(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('lists all todos', () => {
      insertTodo(db, { raw_input: 'Todo 1' });
      insertTodo(db, { raw_input: 'Todo 2' });
      insertTodo(db, { raw_input: 'Todo 3' });

      const result = TodoService.list(db);
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by status', () => {
      insertTodo(db, { raw_input: 'Sketch todo', status: 'sketch' });
      insertTodo(db, { raw_input: 'Ready todo', status: 'ready' });
      insertTodo(db, { raw_input: 'Done todo', status: 'done' });

      const result = TodoService.list(db, { status: TodoStatus.Sketch });
      expect(result.total).toBe(1);
      expect(result.data[0]?.raw_input).toBe('Sketch todo');
    });

    it('filters by goalId', () => {
      const goalId = insertGoal(db, { raw_input: 'Test goal' });
      insertTodo(db, { raw_input: 'With goal', goal_id: goalId });
      insertTodo(db, { raw_input: 'Without goal' });

      const result = TodoService.list(db, { goalId: goalId });
      expect(result.total).toBe(1);
      expect(result.data[0]?.raw_input).toBe('With goal');
    });

    it('paginates results', () => {
      for (let i = 0; i < 5; i++) {
        insertTodo(db, { raw_input: `Todo ${i}` });
      }

      const page1 = TodoService.list(db, undefined, { page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);

      const page3 = TodoService.list(db, undefined, { page: 3, pageSize: 2 });
      expect(page3.data).toHaveLength(1);
    });

    it('returns empty result when no todos exist', () => {
      const result = TodoService.list(db);
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('transition', () => {
    it('transitions sketch → ready via enrich', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'sketch' });
      const todo = TodoService.transition(db, id, TodoStatus.Ready);
      expect(todo.status).toBe(TodoStatus.Ready);
    });

    it('transitions ready → in_progress', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'ready' });
      const todo = TodoService.transition(db, id, TodoStatus.InProgress);
      expect(todo.status).toBe(TodoStatus.InProgress);
    });

    it('transitions in_progress → paused', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'in_progress' });
      const todo = TodoService.transition(db, id, TodoStatus.Paused);
      expect(todo.status).toBe(TodoStatus.Paused);
    });

    it('transitions in_progress → done', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'in_progress' });
      const todo = TodoService.transition(db, id, TodoStatus.Done);
      expect(todo.status).toBe(TodoStatus.Done);
    });

    it('transitions paused → in_progress', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'paused' });
      const todo = TodoService.transition(db, id, TodoStatus.InProgress);
      expect(todo.status).toBe(TodoStatus.InProgress);
    });

    it('allows cancellation from sketch', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'sketch' });
      const todo = TodoService.transition(db, id, TodoStatus.Cancelled);
      expect(todo.status).toBe(TodoStatus.Cancelled);
    });

    it('allows cancellation from ready', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'ready' });
      const todo = TodoService.transition(db, id, TodoStatus.Cancelled);
      expect(todo.status).toBe(TodoStatus.Cancelled);
    });

    it('allows cancellation from in_progress', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'in_progress' });
      const todo = TodoService.transition(db, id, TodoStatus.Cancelled);
      expect(todo.status).toBe(TodoStatus.Cancelled);
    });

    it('allows cancellation from paused', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'paused' });
      const todo = TodoService.transition(db, id, TodoStatus.Cancelled);
      expect(todo.status).toBe(TodoStatus.Cancelled);
    });

    it('rejects transition from done', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'done' });
      expect(() => TodoService.transition(db, id, TodoStatus.InProgress)).toThrow(
        InvalidTransitionError,
      );
    });

    it('rejects transition from cancelled', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'cancelled' });
      expect(() => TodoService.transition(db, id, TodoStatus.InProgress)).toThrow(
        InvalidTransitionError,
      );
    });

    it('rejects invalid transition sketch → done', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'sketch' });
      expect(() => TodoService.transition(db, id, TodoStatus.Done)).toThrow(InvalidTransitionError);
    });

    it('rejects invalid transition ready → done', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'ready' });
      expect(() => TodoService.transition(db, id, TodoStatus.Done)).toThrow(InvalidTransitionError);
    });

    it('throws NotFoundError for missing todo', () => {
      expect(() => TodoService.transition(db, 999, TodoStatus.Ready)).toThrow(NotFoundError);
    });
  });

  describe('enrich', () => {
    it('enriches a todo with title', () => {
      const id = insertTodo(db, { raw_input: 'Buy stuff' });
      const todo = TodoService.enrich(db, id, { title: 'Buy groceries from store' });
      expect(todo.title).toBe('Buy groceries from store');
      expect(todo.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('enriches with all fields', () => {
      const goalId = insertGoal(db, { raw_input: 'Enrichment goal' });
      const id = insertTodo(db, { raw_input: 'Project work' });
      const todo = TodoService.enrich(db, id, {
        title: 'Complete project report',
        priority: 'high',
        due_date: '2026-04-01',
        goal_id: goalId,
      });
      expect(todo.title).toBe('Complete project report');
      expect(todo.priority).toBe('high');
      expect(todo.due_date).toBe('2026-04-01');
      expect(todo.goal_id).toBe(goalId);
      expect(todo.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('transitions sketch to ready on enrich', () => {
      const id = insertTodo(db, { raw_input: 'Sketch todo', status: 'sketch' });
      const todo = TodoService.enrich(db, id, { title: 'Now ready' });
      expect(todo.status).toBe(TodoStatus.Ready);
    });

    it('does not change status when enriching a non-sketch todo', () => {
      const id = insertTodo(db, { raw_input: 'Test', status: 'in_progress' });
      const todo = TodoService.enrich(db, id, { title: 'Updated title' });
      expect(todo.status).toBe(TodoStatus.InProgress);
    });

    it('throws NotFoundError for missing todo', () => {
      expect(() => TodoService.enrich(db, 999, { title: 'Nope' })).toThrow(NotFoundError);
    });
  });

  describe('soft-delete', () => {
    it('excludes soft-deleted todos from list by default', () => {
      const id1 = insertTodo(db, { raw_input: 'Active todo' });
      const id2 = insertTodo(db, { raw_input: 'Deleted todo' });
      TodoService.softDeleteEntity(db, id2);

      const result = TodoService.list(db);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(id1);
    });

    it('includes soft-deleted todos when includeDeleted is true', () => {
      insertTodo(db, { raw_input: 'Active todo' });
      const id2 = insertTodo(db, { raw_input: 'Deleted todo' });
      TodoService.softDeleteEntity(db, id2);

      const result = TodoService.list(db, { includeDeleted: true });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('soft-delete and restore round-trip', () => {
      const id = insertTodo(db, { raw_input: 'Round-trip todo' });
      TodoService.softDeleteEntity(db, id);

      const afterDelete = TodoService.list(db);
      expect(afterDelete.total).toBe(0);

      TodoService.restoreEntity(db, id);

      const afterRestore = TodoService.list(db);
      expect(afterRestore.total).toBe(1);
      expect(afterRestore.data[0]?.id).toBe(id);
    });

    it('throws NotFoundError when soft-deleting non-existent todo', () => {
      expect(() => TodoService.softDeleteEntity(db, 999)).toThrow(NotFoundError);
    });

    it('throws NotFoundError when restoring non-existent todo', () => {
      expect(() => TodoService.restoreEntity(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('due date filters', () => {
    it('overdue filter returns past-due non-terminal todos', () => {
      const todo = TodoService.create(db, 'overdue task');
      TodoService.enrich(db, todo.id, { due_date: '2020-01-01' });
      TodoService.transition(db, todo.id, TodoStatus.InProgress);

      const result = TodoService.list(db, { overdue: true });
      expect(result.data.some(t => t.id === todo.id)).toBe(true);
    });

    it('overdue filter excludes done todos', () => {
      const todo = TodoService.create(db, 'done overdue');
      TodoService.enrich(db, todo.id, { due_date: '2020-01-01' });
      TodoService.transition(db, todo.id, TodoStatus.InProgress);
      TodoService.transition(db, todo.id, TodoStatus.Done);

      const result = TodoService.list(db, { overdue: true });
      expect(result.data.some(t => t.id === todo.id)).toBe(false);
    });

    it('overdue filter excludes todos with null due_date', () => {
      TodoService.create(db, 'no due date');

      const result = TodoService.list(db, { overdue: true });
      expect(result.data.every(t => t.due_date !== null)).toBe(true);
    });

    it('dueToday filter returns todos due today', () => {
      const todo = TodoService.create(db, 'due today');
      const today = new Date().toISOString().split('T')[0]!;
      TodoService.enrich(db, todo.id, { due_date: today });

      const result = TodoService.list(db, { dueToday: true });
      expect(result.data.some(t => t.id === todo.id)).toBe(true);
    });

    it('overdue filter excludes soft-deleted todos', () => {
      const todo = TodoService.create(db, 'overdue then deleted');
      TodoService.enrich(db, todo.id, { due_date: '2020-01-01' });
      TodoService.transition(db, todo.id, TodoStatus.InProgress);

      const beforeDelete = TodoService.list(db, { overdue: true });
      expect(beforeDelete.data.some(t => t.id === todo.id)).toBe(true);

      TodoService.softDeleteEntity(db, todo.id);

      const afterDelete = TodoService.list(db, { overdue: true });
      expect(afterDelete.data.some(t => t.id === todo.id)).toBe(false);
    });
  });
});
