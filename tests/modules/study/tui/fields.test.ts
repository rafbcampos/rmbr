import { describe, it, expect } from 'bun:test';
import {
  STUDY_DETAIL_FIELDS,
  STUDY_EDIT_FIELDS,
} from '../../../../src/modules/study/tui/fields.ts';
import { FieldType } from '../../../../src/shared/tui/types.ts';
import type { StudyTopic } from '../../../../src/modules/study/types.ts';
import { StudyStatus, EnrichmentStatus } from '../../../../src/core/types.ts';

const DUMMY_STUDY: StudyTopic = {
  id: 1,
  raw_input: 'test',
  title: null,
  status: StudyStatus.Queued,
  domain: null,
  notes: '[]',
  resources: '[]',
  goal_id: null,
  enrichment_status: EnrichmentStatus.Raw,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  deleted_at: null,
};

describe('study tui fields', () => {
  describe('STUDY_DETAIL_FIELDS', () => {
    it('has 9 entries', () => {
      expect(STUDY_DETAIL_FIELDS).toHaveLength(9);
    });

    it('includes all expected StudyTopic entity keys', () => {
      const expectedKeys = [
        'id',
        'title',
        'status',
        'domain',
        'goal_id',
        'notes',
        'resources',
        'raw_input',
        'created_at',
      ];
      const fieldKeys = STUDY_DETAIL_FIELDS.map(f => f.key);
      for (const key of expectedKeys) {
        expect(fieldKeys).toContain(key);
      }
    });

    it('all field keys are valid StudyTopic entity property names', () => {
      for (const field of STUDY_DETAIL_FIELDS) {
        expect(field.key in DUMMY_STUDY).toBe(true);
      }
    });
  });

  describe('STUDY_EDIT_FIELDS', () => {
    it('excludes all readonly fields', () => {
      for (const field of STUDY_EDIT_FIELDS) {
        expect(field.type).not.toBe(FieldType.ReadOnly);
      }
    });

    it('includes title, domain, goal_id', () => {
      const editKeys = STUDY_EDIT_FIELDS.map(f => f.key);
      expect(editKeys).toEqual(['title', 'domain', 'goal_id']);
    });

    it('notes is readonly (not editable)', () => {
      const notesField = STUDY_DETAIL_FIELDS.find(f => f.key === 'notes');
      expect(notesField).toBeDefined();
      expect(notesField!.type).toBe(FieldType.ReadOnly);
    });

    it('resources is readonly (not editable)', () => {
      const resourcesField = STUDY_DETAIL_FIELDS.find(f => f.key === 'resources');
      expect(resourcesField).toBeDefined();
      expect(resourcesField!.type).toBe(FieldType.ReadOnly);
    });

    it('all field keys are valid StudyTopic entity property names', () => {
      for (const field of STUDY_EDIT_FIELDS) {
        expect(field.key in DUMMY_STUDY).toBe(true);
      }
    });
  });
});
