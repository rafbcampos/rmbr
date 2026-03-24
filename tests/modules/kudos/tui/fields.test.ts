import { describe, it, expect } from 'bun:test';
import {
  KUDOS_DETAIL_FIELDS,
  KUDOS_EDIT_FIELDS,
} from '../../../../src/modules/kudos/tui/fields.ts';
import { FieldType } from '../../../../src/shared/tui/types.ts';
import type { Kudos } from '../../../../src/modules/kudos/types.ts';
import { EnrichmentStatus } from '../../../../src/core/types.ts';

const DUMMY_KUDOS: Kudos = {
  id: 1,
  raw_input: 'test',
  direction: null,
  person: null,
  summary: null,
  context: null,
  goal_id: null,
  enrichment_status: EnrichmentStatus.Raw,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  deleted_at: null,
};

describe('kudos tui fields', () => {
  describe('KUDOS_DETAIL_FIELDS', () => {
    it('has 8 entries', () => {
      expect(KUDOS_DETAIL_FIELDS).toHaveLength(8);
    });

    it('includes all expected Kudos entity keys', () => {
      const expectedKeys = [
        'id',
        'direction',
        'person',
        'summary',
        'context',
        'goal_id',
        'raw_input',
        'created_at',
      ];
      const fieldKeys = KUDOS_DETAIL_FIELDS.map(f => f.key);
      for (const key of expectedKeys) {
        expect(fieldKeys).toContain(key);
      }
    });

    it('all field keys are valid Kudos entity property names', () => {
      for (const field of KUDOS_DETAIL_FIELDS) {
        expect(field.key in DUMMY_KUDOS).toBe(true);
      }
    });
  });

  describe('KUDOS_EDIT_FIELDS', () => {
    it('excludes all readonly fields', () => {
      for (const field of KUDOS_EDIT_FIELDS) {
        expect(field.type).not.toBe(FieldType.ReadOnly);
      }
    });

    it('includes only editable fields', () => {
      const editKeys = KUDOS_EDIT_FIELDS.map(f => f.key);
      expect(editKeys).toEqual(['direction', 'person', 'summary', 'context', 'goal_id']);
    });

    it('all field keys are valid Kudos entity property names', () => {
      for (const field of KUDOS_EDIT_FIELDS) {
        expect(field.key in DUMMY_KUDOS).toBe(true);
      }
    });
  });

  describe('direction field', () => {
    it('has type cycle with given/received options', () => {
      const directionField = KUDOS_DETAIL_FIELDS.find(f => f.key === 'direction');
      expect(directionField).toBeDefined();
      expect(directionField!.type).toBe(FieldType.Cycle);
      if (directionField!.type === FieldType.Cycle) {
        expect(directionField!.options).toEqual(['given', 'received']);
      }
    });
  });
});
