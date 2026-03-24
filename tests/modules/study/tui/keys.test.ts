import { describe, it, expect } from 'bun:test';
import { StudyStatus } from '../../../../src/core/types.ts';
import { KEY, STATUS_KEY_MAP } from '../../../../src/modules/study/tui/keys.ts';

describe('study tui keys', () => {
  describe('KEY', () => {
    it('has unique values for all keys', () => {
      const values = Object.values(KEY);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('includes QUIT key', () => {
      expect(KEY.QUIT).toBe('q');
    });

    it('includes DOMAIN_CYCLE key', () => {
      expect(KEY.DOMAIN_CYCLE).toBe('d');
    });
  });

  describe('STATUS_KEY_MAP', () => {
    it('maps STATUS_ALL to undefined', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_ALL]).toBeUndefined();
    });

    it('maps STATUS_QUEUED to StudyStatus.Queued', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_QUEUED]).toBe(StudyStatus.Queued);
    });

    it('maps STATUS_IN_PROGRESS to StudyStatus.InProgress', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_IN_PROGRESS]).toBe(StudyStatus.InProgress);
    });

    it('maps STATUS_COMPLETED to StudyStatus.Completed', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_COMPLETED]).toBe(StudyStatus.Completed);
    });

    it('maps STATUS_PARKED to StudyStatus.Parked', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_PARKED]).toBe(StudyStatus.Parked);
    });

    it('covers all StudyStatus values', () => {
      const mappedStatuses = Object.values(STATUS_KEY_MAP).filter(
        (v): v is StudyStatus => v !== undefined,
      );
      const allStatuses = Object.values(StudyStatus);
      expect(new Set(mappedStatuses)).toEqual(new Set(allStatuses));
    });
  });
});
