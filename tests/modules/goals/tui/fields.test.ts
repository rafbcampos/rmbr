import { describe, it, expect } from 'bun:test';
import { GOAL_DETAIL_FIELDS, GOAL_EDIT_FIELDS } from '../../../../src/modules/goals/tui/fields.ts';
import { FieldType } from '../../../../src/shared/tui/types.ts';
import type { Goal } from '../../../../src/modules/goals/types.ts';
import { GoalStatus, EnrichmentStatus } from '../../../../src/core/types.ts';

const DUMMY_GOAL: Goal = {
  id: 1,
  raw_input: 'test',
  title: 'test',
  status: GoalStatus.Draft,
  quarter: null,
  year: null,
  kpis: '[]',
  enrichment_status: EnrichmentStatus.Raw,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  deleted_at: null,
};

describe('goals tui fields', () => {
  describe('GOAL_DETAIL_FIELDS', () => {
    it('has 8 entries', () => {
      expect(GOAL_DETAIL_FIELDS).toHaveLength(8);
    });

    it('includes all expected Goal entity keys', () => {
      const expectedKeys = [
        'id',
        'title',
        'status',
        'quarter',
        'year',
        'kpis',
        'raw_input',
        'created_at',
      ];
      const fieldKeys = GOAL_DETAIL_FIELDS.map(f => f.key);
      for (const key of expectedKeys) {
        expect(fieldKeys).toContain(key);
      }
    });

    it('all field keys are valid Goal entity property names', () => {
      for (const field of GOAL_DETAIL_FIELDS) {
        expect(field.key in DUMMY_GOAL).toBe(true);
      }
    });
  });

  describe('GOAL_EDIT_FIELDS', () => {
    it('excludes all readonly fields', () => {
      for (const field of GOAL_EDIT_FIELDS) {
        expect(field.type).not.toBe(FieldType.ReadOnly);
      }
    });

    it('includes only editable fields', () => {
      const editKeys = GOAL_EDIT_FIELDS.map(f => f.key);
      expect(editKeys).toEqual(['title', 'quarter', 'year', 'kpis']);
    });

    it('all field keys are valid Goal entity property names', () => {
      for (const field of GOAL_EDIT_FIELDS) {
        expect(field.key in DUMMY_GOAL).toBe(true);
      }
    });
  });

  describe('quarter field', () => {
    it('has type cycle with Q1-Q4 options', () => {
      const quarterField = GOAL_DETAIL_FIELDS.find(f => f.key === 'quarter');
      expect(quarterField).toBeDefined();
      expect(quarterField!.type).toBe(FieldType.Cycle);
      if (quarterField!.type === FieldType.Cycle) {
        expect(quarterField!.options).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
      }
    });
  });

  describe('year field', () => {
    it('has type number', () => {
      const yearField = GOAL_DETAIL_FIELDS.find(f => f.key === 'year');
      expect(yearField).toBeDefined();
      expect(yearField!.type).toBe(FieldType.Number);
    });
  });
});
