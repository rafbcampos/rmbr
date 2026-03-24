import { describe, it, expect } from 'bun:test';
import { SlackSentiment } from '../../../../src/core/types.ts';
import { KEY, PROCESSED_KEY_MAP, SENTIMENT_ORDER } from '../../../../src/modules/slack/tui/keys.ts';

describe('slack tui keys', () => {
  describe('KEY', () => {
    it('has unique values for all keys', () => {
      const values = Object.values(KEY);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('PROCESSED_KEY_MAP', () => {
    it('maps FILTER_ALL to undefined', () => {
      expect(PROCESSED_KEY_MAP[KEY.FILTER_ALL]).toBeUndefined();
    });

    it('maps UNPROCESSED to 0', () => {
      expect(PROCESSED_KEY_MAP[KEY.UNPROCESSED]).toBe(0);
    });

    it('maps PROCESSED to 1', () => {
      expect(PROCESSED_KEY_MAP[KEY.PROCESSED]).toBe(1);
    });
  });

  describe('SENTIMENT_ORDER', () => {
    it('has undefined at index 0', () => {
      expect(SENTIMENT_ORDER[0]).toBeUndefined();
    });

    it('covers all SlackSentiment values', () => {
      const sentimentsInOrder = SENTIMENT_ORDER.filter((v): v is SlackSentiment => v !== undefined);
      const allSentiments = Object.values(SlackSentiment);
      expect(new Set(sentimentsInOrder)).toEqual(new Set(allSentiments));
    });
  });
});
