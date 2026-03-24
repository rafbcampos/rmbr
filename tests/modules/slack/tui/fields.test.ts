import { describe, it, expect } from 'bun:test';
import {
  SLACK_DETAIL_FIELDS,
  SLACK_EDIT_FIELDS,
} from '../../../../src/modules/slack/tui/fields.ts';
import { FieldType } from '../../../../src/shared/tui/types.ts';
import type { SlackMessage } from '../../../../src/modules/slack/types.ts';
import { EnrichmentStatus } from '../../../../src/core/types.ts';

const DUMMY_SLACK: SlackMessage = {
  id: 1,
  raw_input: 'test',
  raw_content: 'test content',
  channel: null,
  sender: null,
  message_ts: null,
  sentiment: null,
  processed: 0,
  todo_id: null,
  goal_id: null,
  enrichment_status: EnrichmentStatus.Raw,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  deleted_at: null,
};

describe('slack tui fields', () => {
  describe('SLACK_DETAIL_FIELDS', () => {
    it('has 9 entries', () => {
      expect(SLACK_DETAIL_FIELDS).toHaveLength(9);
    });

    it('includes all expected SlackMessage relevant keys', () => {
      const expectedKeys = [
        'id',
        'raw_content',
        'channel',
        'sender',
        'sentiment',
        'processed',
        'todo_id',
        'goal_id',
        'created_at',
      ];
      const fieldKeys = SLACK_DETAIL_FIELDS.map(f => f.key);
      for (const key of expectedKeys) {
        expect(fieldKeys).toContain(key);
      }
    });

    it('all field keys are valid SlackMessage entity property names', () => {
      for (const field of SLACK_DETAIL_FIELDS) {
        expect(field.key in DUMMY_SLACK).toBe(true);
      }
    });
  });

  describe('SLACK_EDIT_FIELDS', () => {
    it('excludes all readonly fields', () => {
      for (const field of SLACK_EDIT_FIELDS) {
        expect(field.type).not.toBe(FieldType.ReadOnly);
      }
    });

    it('includes sentiment, todo_id, goal_id', () => {
      const editKeys = SLACK_EDIT_FIELDS.map(f => f.key);
      expect(editKeys).toEqual(['sentiment', 'todo_id', 'goal_id']);
    });

    it('all field keys are valid SlackMessage entity property names', () => {
      for (const field of SLACK_EDIT_FIELDS) {
        expect(field.key in DUMMY_SLACK).toBe(true);
      }
    });
  });

  describe('sentiment field', () => {
    it('has type cycle with correct options', () => {
      const sentimentField = SLACK_DETAIL_FIELDS.find(f => f.key === 'sentiment');
      expect(sentimentField).toBeDefined();
      expect(sentimentField!.type).toBe(FieldType.Cycle);
      if (sentimentField!.type === FieldType.Cycle) {
        expect(sentimentField!.options).toEqual(['positive', 'negative', 'neutral']);
      }
    });
  });
});
