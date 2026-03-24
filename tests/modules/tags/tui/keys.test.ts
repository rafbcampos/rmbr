import { describe, it, expect } from 'bun:test';
import { EntityType } from '../../../../src/modules/tags/types.ts';
import { KEY, ENTITY_TYPE_COLORS } from '../../../../src/modules/tags/tui/keys.ts';

describe('tags tui keys', () => {
  describe('KEY', () => {
    it('has unique values for all keys', () => {
      const values = Object.values(KEY);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('ENTITY_TYPE_COLORS', () => {
    it('covers all EntityType values', () => {
      const allTypes = Object.values(EntityType);
      const coloredTypes = Object.keys(ENTITY_TYPE_COLORS);
      expect(new Set(coloredTypes)).toEqual(new Set(allTypes));
    });

    it('maps every EntityType to a non-empty string', () => {
      for (const entityType of Object.values(EntityType)) {
        expect(ENTITY_TYPE_COLORS[entityType]).toBeTruthy();
        expect(typeof ENTITY_TYPE_COLORS[entityType]).toBe('string');
      }
    });
  });
});
