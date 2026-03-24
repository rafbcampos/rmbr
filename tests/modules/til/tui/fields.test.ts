import { describe, it, expect } from 'bun:test';
import { TIL_DETAIL_FIELDS, TIL_EDIT_FIELDS } from '../../../../src/modules/til/tui/fields.ts';
import { FieldType } from '../../../../src/shared/tui/types.ts';
import type { Til } from '../../../../src/modules/til/types.ts';
import { EnrichmentStatus } from '../../../../src/core/types.ts';

const DUMMY_TIL: Til = {
  id: 1,
  raw_input: 'test',
  title: null,
  content: null,
  domain: null,
  tags: '[]',
  enrichment_status: EnrichmentStatus.Raw,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  deleted_at: null,
};

describe('til tui fields', () => {
  describe('TIL_DETAIL_FIELDS', () => {
    it('has 7 entries', () => {
      expect(TIL_DETAIL_FIELDS).toHaveLength(7);
    });

    it('includes all expected Til entity keys', () => {
      const expectedKeys = ['id', 'title', 'content', 'domain', 'tags', 'raw_input', 'created_at'];
      const fieldKeys = TIL_DETAIL_FIELDS.map(f => f.key);
      for (const key of expectedKeys) {
        expect(fieldKeys).toContain(key);
      }
    });

    it('all field keys are valid Til entity property names', () => {
      for (const field of TIL_DETAIL_FIELDS) {
        expect(field.key in DUMMY_TIL).toBe(true);
      }
    });
  });

  describe('TIL_EDIT_FIELDS', () => {
    it('excludes all readonly fields', () => {
      for (const field of TIL_EDIT_FIELDS) {
        expect(field.type).not.toBe(FieldType.ReadOnly);
      }
    });

    it('includes only editable fields', () => {
      const editKeys = TIL_EDIT_FIELDS.map(f => f.key);
      expect(editKeys).toEqual(['title', 'content', 'domain', 'tags']);
    });

    it('all edit fields are type text', () => {
      for (const field of TIL_EDIT_FIELDS) {
        expect(field.type).toBe(FieldType.Text);
      }
    });

    it('all field keys are valid Til entity property names', () => {
      for (const field of TIL_EDIT_FIELDS) {
        expect(field.key in DUMMY_TIL).toBe(true);
      }
    });
  });
});
