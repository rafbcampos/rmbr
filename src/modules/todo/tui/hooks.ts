import { useState, useEffect, useCallback } from 'react';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import type { TodoStatus } from '../../../core/types.ts';
import { TodoStatus as TodoStatusEnum } from '../../../core/types.ts';
import type { Todo, TimeEntry } from '../types.ts';
import { TodoService } from '../service.ts';
import { TimeEntryService } from '../time-entry-service.ts';

export interface TodoListState {
  readonly todos: readonly Todo[];
  readonly total: number;
  reload: () => void;
}

export function useTodos(
  db: DrizzleDatabase,
  statusFilter: TodoStatus | undefined,
  priorityFilter: string | undefined,
): TodoListState {
  const [todos, setTodos] = useState<readonly Todo[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const excludeTerminal = statusFilter === undefined;
    const filters = statusFilter !== undefined ? { status: statusFilter } : {};
    const result = TodoService.list(db, filters, { page: 1, pageSize: 100 });
    let filtered = result.data;
    if (excludeTerminal) {
      filtered = filtered.filter(
        t => t.status !== TodoStatusEnum.Done && t.status !== TodoStatusEnum.Cancelled,
      );
    }
    if (priorityFilter !== undefined) {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    setTodos(filtered);
    setTotal(filtered.length);
  }, [db, statusFilter, priorityFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { todos, total, reload };
}

export function useActiveTimer(db: DrizzleDatabase): TimeEntry | null {
  const [entry, setEntry] = useState<TimeEntry | null>(null);

  useEffect(() => {
    const check = () => {
      setEntry(TimeEntryService.getAnyActive(db));
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [db]);

  return entry;
}

export function useElapsedSeconds(db: DrizzleDatabase, todoId: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (todoId === null) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      setElapsed(TimeEntryService.totalElapsed(db, todoId));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [db, todoId]);

  return elapsed;
}
