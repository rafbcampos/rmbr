import { describe, it, expect } from 'bun:test';
import { ViewMode, FieldType } from '../../../src/shared/tui/types.ts';

describe('shared tui types', () => {
  describe('ViewMode', () => {
    it('has exactly 2 values', () => {
      const values = Object.values(ViewMode);
      expect(values).toHaveLength(2);
    });

    it('has List value as "list"', () => {
      expect(ViewMode.List).toBe('list');
    });

    it('has Edit value as "edit"', () => {
      expect(ViewMode.Edit).toBe('edit');
    });

    it('all values are lowercase strings', () => {
      for (const value of Object.values(ViewMode)) {
        expect(typeof value).toBe('string');
        expect(String(value).toLowerCase()).toBe(String(value));
      }
    });

    it('has unique values', () => {
      const values = Object.values(ViewMode);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('FieldType', () => {
    it('has exactly 4 values', () => {
      const values = Object.values(FieldType);
      expect(values).toHaveLength(4);
    });

    it('has Text value as "text"', () => {
      expect(FieldType.Text).toBe('text');
    });

    it('has Cycle value as "cycle"', () => {
      expect(FieldType.Cycle).toBe('cycle');
    });

    it('has Number value as "number"', () => {
      expect(FieldType.Number).toBe('number');
    });

    it('has ReadOnly value as "readonly"', () => {
      expect(FieldType.ReadOnly).toBe('readonly');
    });

    it('all values are lowercase strings', () => {
      for (const value of Object.values(FieldType)) {
        expect(typeof value).toBe('string');
        expect(String(value).toLowerCase()).toBe(String(value));
      }
    });

    it('has unique values', () => {
      const values = Object.values(FieldType);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });
});
