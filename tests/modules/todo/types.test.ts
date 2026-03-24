import { describe, it, expect } from 'bun:test';
import { TodoStatus, TodoPriority, EnrichmentStatus } from '../../../src/core/types.ts';
import { ValidationError } from '../../../src/core/errors.ts';
import {
  isTodoStatus,
  isTodoPriority,
  parseTodoStatus,
  todoRowToEntity,
} from '../../../src/modules/todo/types.ts';
import type { TodoRow } from '../../../src/modules/todo/types.ts';

function makeTodoRow(overrides: Partial<TodoRow> = {}): TodoRow {
  return {
    id: 1,
    raw_input: 'Test todo',
    title: null,
    status: TodoStatus.Sketch,
    priority: null,
    due_date: null,
    goal_id: null,
    enrichment_status: EnrichmentStatus.Raw,
    created_at: '2024-01-01 00:00:00',
    updated_at: '2024-01-01 00:00:00',
    deleted_at: null,
    ...overrides,
  };
}

describe('isTodoStatus', () => {
  it('returns true for each valid TodoStatus value', () => {
    expect(isTodoStatus(TodoStatus.Sketch)).toBe(true);
    expect(isTodoStatus(TodoStatus.Ready)).toBe(true);
    expect(isTodoStatus(TodoStatus.InProgress)).toBe(true);
    expect(isTodoStatus(TodoStatus.Paused)).toBe(true);
    expect(isTodoStatus(TodoStatus.Done)).toBe(true);
    expect(isTodoStatus(TodoStatus.Cancelled)).toBe(true);
  });

  it('returns false for invalid status strings', () => {
    expect(isTodoStatus('invalid')).toBe(false);
    expect(isTodoStatus('')).toBe(false);
    expect(isTodoStatus('SKETCH')).toBe(false);
    expect(isTodoStatus('Draft')).toBe(false);
  });
});

describe('isTodoPriority', () => {
  it('returns true for each valid TodoPriority value', () => {
    expect(isTodoPriority(TodoPriority.Critical)).toBe(true);
    expect(isTodoPriority(TodoPriority.High)).toBe(true);
    expect(isTodoPriority(TodoPriority.Medium)).toBe(true);
    expect(isTodoPriority(TodoPriority.Low)).toBe(true);
  });

  it('returns false for invalid priority strings', () => {
    expect(isTodoPriority('invalid')).toBe(false);
    expect(isTodoPriority('')).toBe(false);
    expect(isTodoPriority('HIGH')).toBe(false);
    expect(isTodoPriority('Critical')).toBe(false);
  });

  it('covers all TodoPriority values', () => {
    for (const value of Object.values(TodoPriority)) {
      expect(isTodoPriority(value)).toBe(true);
    }
  });
});

describe('parseTodoStatus', () => {
  it('returns the status for each valid value', () => {
    expect(parseTodoStatus(TodoStatus.Sketch)).toBe(TodoStatus.Sketch);
    expect(parseTodoStatus(TodoStatus.Ready)).toBe(TodoStatus.Ready);
    expect(parseTodoStatus(TodoStatus.InProgress)).toBe(TodoStatus.InProgress);
    expect(parseTodoStatus(TodoStatus.Paused)).toBe(TodoStatus.Paused);
    expect(parseTodoStatus(TodoStatus.Done)).toBe(TodoStatus.Done);
    expect(parseTodoStatus(TodoStatus.Cancelled)).toBe(TodoStatus.Cancelled);
  });

  it('throws ValidationError for invalid status', () => {
    expect(() => parseTodoStatus('invalid')).toThrow(ValidationError);
    expect(() => parseTodoStatus('')).toThrow(ValidationError);
    expect(() => parseTodoStatus('DONE')).toThrow(ValidationError);
  });
});

describe('todoRowToEntity', () => {
  it('converts a valid row to a Todo entity', () => {
    const row = makeTodoRow({
      id: 42,
      raw_input: 'Buy groceries',
      title: 'Grocery shopping',
      status: TodoStatus.Ready,
      priority: 'high',
      due_date: '2024-06-15',
      goal_id: 5,
      enrichment_status: EnrichmentStatus.Enriched,
    });

    const entity = todoRowToEntity(row);
    expect(entity.id).toBe(42);
    expect(entity.raw_input).toBe('Buy groceries');
    expect(entity.title).toBe('Grocery shopping');
    expect(entity.status).toBe(TodoStatus.Ready);
    expect(entity.priority).toBe('high');
    expect(entity.due_date).toBe('2024-06-15');
    expect(entity.goal_id).toBe(5);
    expect(entity.enrichment_status).toBe(EnrichmentStatus.Enriched);
  });

  it('defaults invalid status to Sketch', () => {
    const row = makeTodoRow({ status: 'bogus_status' });
    const entity = todoRowToEntity(row);
    expect(entity.status).toBe(TodoStatus.Sketch);
  });

  it('preserves null fields', () => {
    const row = makeTodoRow();
    const entity = todoRowToEntity(row);
    expect(entity.title).toBeNull();
    expect(entity.priority).toBeNull();
    expect(entity.due_date).toBeNull();
    expect(entity.goal_id).toBeNull();
  });

  it('defaults unknown enrichment_status to Raw', () => {
    const row = makeTodoRow({ enrichment_status: 'unknown_status' });
    const entity = todoRowToEntity(row);
    expect(entity.enrichment_status).toBe(EnrichmentStatus.Raw);
  });
});
