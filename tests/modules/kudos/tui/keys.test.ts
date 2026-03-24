import { describe, it, expect } from 'bun:test';
import { KudosDirection } from '../../../../src/core/types.ts';
import { KEY, DIRECTION_KEY_MAP } from '../../../../src/modules/kudos/tui/keys.ts';

describe('kudos tui keys', () => {
  describe('KEY', () => {
    it('has unique values for all keys', () => {
      const values = Object.values(KEY);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('DIRECTION_KEY_MAP', () => {
    it('maps FILTER_ALL to undefined', () => {
      expect(DIRECTION_KEY_MAP[KEY.FILTER_ALL]).toBeUndefined();
    });

    it('maps FILTER_GIVEN to KudosDirection.Given', () => {
      expect(DIRECTION_KEY_MAP[KEY.FILTER_GIVEN]).toBe(KudosDirection.Given);
    });

    it('maps FILTER_RECEIVED to KudosDirection.Received', () => {
      expect(DIRECTION_KEY_MAP[KEY.FILTER_RECEIVED]).toBe(KudosDirection.Received);
    });

    it('covers all KudosDirection values', () => {
      const mappedDirections = Object.values(DIRECTION_KEY_MAP).filter(
        (v): v is KudosDirection => v !== undefined,
      );
      const allDirections = Object.values(KudosDirection);
      expect(new Set(mappedDirections)).toEqual(new Set(allDirections));
    });
  });
});
