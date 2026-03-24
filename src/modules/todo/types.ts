import type { BaseEntity, TodoPriority } from '../../core/types.ts';
import { TodoStatus } from '../../core/types.ts';
import { TodoPriority as TodoPriorityEnum } from '../../core/types.ts';
import { parseEnrichmentStatus } from '../../shared/type-guards.ts';
import { ValidationError } from '../../core/errors.ts';

const TODO_PRIORITIES = new Set<string>(Object.values(TodoPriorityEnum));

export function isTodoPriority(value: string): value is TodoPriority {
  return TODO_PRIORITIES.has(value);
}

export interface Todo extends BaseEntity {
  readonly title: string | null;
  readonly status: TodoStatus;
  readonly priority: string | null;
  readonly due_date: string | null;
  readonly goal_id: number | null;
}

export interface TodoRow {
  id: number;
  raw_input: string;
  title: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  goal_id: number | null;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const TODO_STATUSES = new Set<string>(Object.values(TodoStatus));

export function isTodoStatus(value: string): value is TodoStatus {
  return TODO_STATUSES.has(value);
}

export function parseTodoStatus(value: string): TodoStatus {
  if (isTodoStatus(value)) {
    return value;
  }
  throw new ValidationError(`Invalid todo status: '${value}'`);
}

export interface TimeEntryRow {
  id: number;
  todo_id: number;
  started_at: string;
  stopped_at: string | null;
  created_at: string;
}

export interface TimeEntry {
  readonly id: number;
  readonly todo_id: number;
  readonly started_at: string;
  readonly stopped_at: string | null;
  readonly duration_seconds: number;
  readonly created_at: string;
}

export interface TodoWithTime extends Todo {
  readonly total_elapsed_seconds: number;
  readonly active_entry_id: number | null;
}

export function timeEntryRowToEntity(row: TimeEntryRow): TimeEntry {
  const startMs = Date.parse(row.started_at);
  const stopMs = row.stopped_at !== null ? Date.parse(row.stopped_at) : Date.now();
  const durationSeconds = Math.max(0, Math.floor((stopMs - startMs) / 1000));
  return {
    id: row.id,
    todo_id: row.todo_id,
    started_at: row.started_at,
    stopped_at: row.stopped_at,
    duration_seconds: durationSeconds,
    created_at: row.created_at,
  };
}

export function todoRowToEntity(row: TodoRow): Todo {
  const status = isTodoStatus(row.status) ? row.status : TodoStatus.Sketch;
  const enrichmentStatus = parseEnrichmentStatus(row.enrichment_status);

  return {
    id: row.id,
    raw_input: row.raw_input,
    title: row.title,
    status,
    priority: row.priority,
    due_date: row.due_date,
    goal_id: row.goal_id,
    enrichment_status: enrichmentStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}
