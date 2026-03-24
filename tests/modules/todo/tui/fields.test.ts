import { describe, it, expect } from 'bun:test';
import { TODO_DETAIL_FIELDS, TODO_EDIT_FIELDS } from '../../../../src/modules/todo/tui/fields.ts';
import { FieldType } from '../../../../src/shared/tui/types.ts';
import type { Todo } from '../../../../src/modules/todo/types.ts';
import { TodoStatus, EnrichmentStatus } from '../../../../src/core/types.ts';

const DUMMY_TODO: Todo = {
  id: 1,
  raw_input: 'test',
  title: 'test',
  status: TodoStatus.Sketch,
  priority: 'medium',
  due_date: null,
  goal_id: null,
  enrichment_status: EnrichmentStatus.Raw,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  deleted_at: null,
};

describe('todo tui fields', () => {
  describe('TODO_DETAIL_FIELDS', () => {
    it('has 8 entries', () => {
      expect(TODO_DETAIL_FIELDS).toHaveLength(8);
    });

    it('includes all expected Todo entity keys', () => {
      const expectedKeys = [
        'id',
        'title',
        'status',
        'priority',
        'due_date',
        'goal_id',
        'raw_input',
        'created_at',
      ];
      const fieldKeys = TODO_DETAIL_FIELDS.map(f => f.key);
      for (const key of expectedKeys) {
        expect(fieldKeys).toContain(key);
      }
    });

    it('all field keys are valid Todo entity property names', () => {
      for (const field of TODO_DETAIL_FIELDS) {
        expect(field.key in DUMMY_TODO).toBe(true);
      }
    });
  });

  describe('TODO_EDIT_FIELDS', () => {
    it('excludes all readonly fields', () => {
      for (const field of TODO_EDIT_FIELDS) {
        expect(field.type).not.toBe(FieldType.ReadOnly);
      }
    });

    it('includes only editable fields', () => {
      const editKeys = TODO_EDIT_FIELDS.map(f => f.key);
      expect(editKeys).toEqual(['title', 'priority', 'due_date', 'goal_id']);
    });

    it('all field keys are valid Todo entity property names', () => {
      for (const field of TODO_EDIT_FIELDS) {
        expect(field.key in DUMMY_TODO).toBe(true);
      }
    });
  });

  describe('priority field', () => {
    it('has type cycle with correct options', () => {
      const priorityField = TODO_DETAIL_FIELDS.find(f => f.key === 'priority');
      expect(priorityField).toBeDefined();
      expect(priorityField!.type).toBe(FieldType.Cycle);
      if (priorityField!.type === FieldType.Cycle) {
        expect(priorityField!.options).toEqual(['critical', 'high', 'medium', 'low']);
      }
    });
  });
});
