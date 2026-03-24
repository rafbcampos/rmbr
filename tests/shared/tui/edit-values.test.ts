import { describe, it, expect } from 'bun:test';
import { pickString, pickNumber } from '../../../src/shared/tui/edit-values.ts';
import type { EditValues } from '../../../src/shared/tui/edit-form.tsx';

describe('edit-values', () => {
  describe('pickString', () => {
    it('returns the string when key exists with string value', () => {
      const values: EditValues = { name: 'hello' };
      expect(pickString(values, 'name')).toBe('hello');
    });

    it('returns undefined when key exists with number value', () => {
      const values: EditValues = { count: 42 };
      expect(pickString(values, 'count')).toBeUndefined();
    });

    it('returns undefined when key exists with null value', () => {
      const values: EditValues = { name: null };
      expect(pickString(values, 'name')).toBeUndefined();
    });

    it('returns undefined when key does not exist', () => {
      const values: EditValues = {};
      expect(pickString(values, 'missing')).toBeUndefined();
    });
  });

  describe('pickNumber', () => {
    it('returns the number when key exists with number value', () => {
      const values: EditValues = { count: 42 };
      expect(pickNumber(values, 'count')).toBe(42);
    });

    it('returns undefined when key exists with string value', () => {
      const values: EditValues = { name: 'hello' };
      expect(pickNumber(values, 'name')).toBeUndefined();
    });

    it('returns undefined when key exists with null value', () => {
      const values: EditValues = { count: null };
      expect(pickNumber(values, 'count')).toBeUndefined();
    });

    it('returns undefined when key does not exist', () => {
      const values: EditValues = {};
      expect(pickNumber(values, 'missing')).toBeUndefined();
    });
  });
});
