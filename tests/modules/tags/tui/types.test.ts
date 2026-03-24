import { describe, it, expect } from 'bun:test';
import { TagView } from '../../../../src/modules/tags/tui/types.ts';

describe('tags tui types', () => {
  describe('TagView', () => {
    it('has List value as "list"', () => {
      expect(TagView.List).toBe('list');
    });

    it('has Entities value as "entities"', () => {
      expect(TagView.Entities).toBe('entities');
    });

    it('has exactly two values', () => {
      const values = Object.values(TagView);
      expect(values).toHaveLength(2);
    });
  });
});
