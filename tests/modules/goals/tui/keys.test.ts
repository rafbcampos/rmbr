import { describe, it, expect } from 'bun:test';
import { GoalStatus, Quarter } from '../../../../src/core/types.ts';
import { KEY, STATUS_KEY_MAP, QUARTER_ORDER } from '../../../../src/modules/goals/tui/keys.ts';

describe('goals tui keys', () => {
  describe('KEY', () => {
    it('has unique values for all keys', () => {
      const values = Object.values(KEY);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('STATUS_KEY_MAP', () => {
    it('maps STATUS_ALL to undefined', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_ALL]).toBeUndefined();
    });

    it('maps STATUS_DRAFT to GoalStatus.Draft', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_DRAFT]).toBe(GoalStatus.Draft);
    });

    it('maps STATUS_ACTIVE to GoalStatus.Active', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_ACTIVE]).toBe(GoalStatus.Active);
    });

    it('maps STATUS_COMPLETED to GoalStatus.Completed', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_COMPLETED]).toBe(GoalStatus.Completed);
    });

    it('maps STATUS_ABANDONED to GoalStatus.Abandoned', () => {
      expect(STATUS_KEY_MAP[KEY.STATUS_ABANDONED]).toBe(GoalStatus.Abandoned);
    });

    it('covers all GoalStatus values', () => {
      const mappedStatuses = Object.values(STATUS_KEY_MAP).filter(
        (v): v is GoalStatus => v !== undefined,
      );
      const allStatuses = Object.values(GoalStatus);
      expect(new Set(mappedStatuses)).toEqual(new Set(allStatuses));
    });
  });

  describe('QUARTER_ORDER', () => {
    it('starts with undefined for all filter', () => {
      expect(QUARTER_ORDER[0]).toBeUndefined();
    });

    it('covers all Quarter values', () => {
      const quarters = QUARTER_ORDER.filter((v): v is Quarter => v !== undefined);
      const allQuarters = Object.values(Quarter);
      expect(new Set(quarters)).toEqual(new Set(allQuarters));
    });
  });
});
