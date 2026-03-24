import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { todoMigrations } from '../../../src/modules/todo/schema.ts';
import { goalsMigrations as goalMigrations } from '../../../src/modules/goals/schema.ts';
import { TimeEntryService } from '../../../src/modules/todo/time-entry-service.ts';
import { TodoService } from '../../../src/modules/todo/service.ts';
import { ValidationError } from '../../../src/core/errors.ts';
import { TodoStatus } from '../../../src/core/types.ts';
import { insertTodo, insertTimeEntry, insertGoal } from '../../helpers/fixtures.ts';

describe('TimeEntryService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb([...goalMigrations, ...todoMigrations]);
  });

  describe('start', () => {
    it('creates a time entry with started_at and null stopped_at', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      const entry = TimeEntryService.start(db, todoId);

      expect(entry.todo_id).toBe(todoId);
      expect(entry.started_at).toBeTruthy();
      expect(entry.stopped_at).toBeNull();
      expect(entry.duration_seconds).toBeGreaterThanOrEqual(0);
    });

    it('throws when todo already has a running entry', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      TimeEntryService.start(db, todoId);

      expect(() => TimeEntryService.start(db, todoId)).toThrow(ValidationError);
    });
  });

  describe('stop', () => {
    it('sets stopped_at on the running entry', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      TimeEntryService.start(db, todoId);
      const stopped = TimeEntryService.stop(db, todoId);

      expect(stopped.stopped_at).toBeTruthy();
      expect(stopped.duration_seconds).toBeGreaterThanOrEqual(0);
    });

    it('throws when no running entry exists', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      expect(() => TimeEntryService.stop(db, todoId)).toThrow(ValidationError);
    });
  });

  describe('stopAll', () => {
    it('stops all running entries and returns count', () => {
      const id1 = insertTodo(db, { raw_input: 'Task 1', status: TodoStatus.InProgress });
      const id2 = insertTodo(db, { raw_input: 'Task 2', status: TodoStatus.InProgress });
      TimeEntryService.start(db, id1);
      TimeEntryService.start(db, id2);

      const count = TimeEntryService.stopAll(db);
      expect(count).toBe(2);

      expect(TimeEntryService.getActive(db, id1)).toBeNull();
      expect(TimeEntryService.getActive(db, id2)).toBeNull();
    });

    it('returns 0 when no running entries exist', () => {
      expect(TimeEntryService.stopAll(db)).toBe(0);
    });
  });

  describe('getActive', () => {
    it('returns the running entry for a specific todo', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      const started = TimeEntryService.start(db, todoId);
      const active = TimeEntryService.getActive(db, todoId);

      expect(active).not.toBeNull();
      expect(active!.id).toBe(started.id);
    });

    it('returns null when no running entry exists', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      expect(TimeEntryService.getActive(db, todoId)).toBeNull();
    });
  });

  describe('getAnyActive', () => {
    it('returns any running entry across todos', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      TimeEntryService.start(db, todoId);

      const active = TimeEntryService.getAnyActive(db);
      expect(active).not.toBeNull();
      expect(active!.todo_id).toBe(todoId);
    });

    it('returns null when no entries are running', () => {
      expect(TimeEntryService.getAnyActive(db)).toBeNull();
    });
  });

  describe('getRunningCount', () => {
    it('returns 0 with no running entries', () => {
      expect(TimeEntryService.getRunningCount(db)).toBe(0);
    });

    it('returns correct count with multiple running entries', () => {
      const id1 = insertTodo(db, { raw_input: 'Task 1', status: TodoStatus.InProgress });
      const id2 = insertTodo(db, { raw_input: 'Task 2', status: TodoStatus.InProgress });
      TimeEntryService.start(db, id1);
      TimeEntryService.start(db, id2);

      expect(TimeEntryService.getRunningCount(db)).toBe(2);
    });

    it('does not double-count the same todo', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      TimeEntryService.start(db, todoId);

      expect(TimeEntryService.getRunningCount(db)).toBe(1);
    });
  });

  describe('listForTodo', () => {
    it('returns entries ordered by started_at desc', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-21 14:00:00',
        stopped_at: '2026-03-21 15:30:00',
      });

      const entries = TimeEntryService.listForTodo(db, todoId);
      expect(entries).toHaveLength(2);
      expect(entries[0]!.started_at).toBe('2026-03-21 14:00:00');
      expect(entries[1]!.started_at).toBe('2026-03-20 09:00:00');
    });

    it('returns empty array for todo with no entries', () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      expect(TimeEntryService.listForTodo(db, todoId)).toHaveLength(0);
    });
  });

  describe('totalElapsed', () => {
    it('returns 0 when no entries exist', () => {
      const todoId = insertTodo(db, { raw_input: 'Test' });
      expect(TimeEntryService.totalElapsed(db, todoId)).toBe(0);
    });

    it('computes sum of completed entries', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 14:00:00',
        stopped_at: '2026-03-20 14:30:00',
      });

      const elapsed = TimeEntryService.totalElapsed(db, todoId);
      expect(elapsed).toBe(5400);
    });

    it('includes running entry in total', () => {
      const todoId = insertTodo(db, { raw_input: 'Test', status: TodoStatus.InProgress });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });
      TimeEntryService.start(db, todoId);

      const elapsed = TimeEntryService.totalElapsed(db, todoId);
      expect(elapsed).toBeGreaterThanOrEqual(3600);
    });
  });

  describe('getCompletedWithDuration', () => {
    it('returns done todos with aggregated time', () => {
      const todoId = insertTodo(db, { raw_input: 'Done task', status: TodoStatus.Done });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 11:00:00',
      });

      const results = TimeEntryService.getCompletedWithDuration(db);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(todoId);
      expect(results[0]!.total_elapsed_seconds).toBe(7200);
    });

    it('excludes soft-deleted todos', () => {
      const todoId = insertTodo(db, { raw_input: 'Done task', status: TodoStatus.Done });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });
      TodoService.softDeleteEntity(db, todoId);

      const results = TimeEntryService.getCompletedWithDuration(db);
      expect(results).toHaveLength(0);
    });

    it('filters by goalId', () => {
      const goalId = insertGoal(db, { raw_input: 'Test goal' });
      const id1 = insertTodo(db, {
        raw_input: 'With goal',
        status: TodoStatus.Done,
        goal_id: goalId,
      });
      const id2 = insertTodo(db, { raw_input: 'No goal', status: TodoStatus.Done });
      insertTimeEntry(db, {
        todo_id: id1,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });
      insertTimeEntry(db, {
        todo_id: id2,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });

      const results = TimeEntryService.getCompletedWithDuration(db, { goalId: goalId });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(id1);
    });

    it('filters by priority', () => {
      const id1 = insertTodo(db, {
        raw_input: 'High',
        status: TodoStatus.Done,
        priority: 'high',
      });
      insertTodo(db, { raw_input: 'Low', status: TodoStatus.Done, priority: 'low' });
      insertTimeEntry(db, {
        todo_id: id1,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });

      const results = TimeEntryService.getCompletedWithDuration(db, { priority: 'high' });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(id1);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        const id = insertTodo(db, { raw_input: `Task ${i}`, status: TodoStatus.Done });
        insertTimeEntry(db, {
          todo_id: id,
          started_at: '2026-03-20 09:00:00',
          stopped_at: '2026-03-20 10:00:00',
        });
      }

      const results = TimeEntryService.getCompletedWithDuration(db, { limit: 3 });
      expect(results).toHaveLength(3);
    });

    it('returns active_entry_id as null for completed todos', () => {
      const todoId = insertTodo(db, { raw_input: 'Done', status: TodoStatus.Done });
      insertTimeEntry(db, {
        todo_id: todoId,
        started_at: '2026-03-20 09:00:00',
        stopped_at: '2026-03-20 10:00:00',
      });

      const results = TimeEntryService.getCompletedWithDuration(db);
      expect(results[0]!.active_entry_id).toBeNull();
    });
  });
});
