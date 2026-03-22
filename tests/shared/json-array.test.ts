import { describe, it, expect } from 'bun:test';
import { parseStringArray } from '../../src/shared/json-array.ts';

describe('parseStringArray', () => {
  it('returns an array of strings for valid JSON array', () => {
    expect(parseStringArray('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for an empty JSON array', () => {
    expect(parseStringArray('[]')).toEqual([]);
  });

  it('returns an empty array for a JSON object', () => {
    expect(parseStringArray('{"key": "value"}')).toEqual([]);
  });

  it('returns an empty array for a JSON number', () => {
    expect(parseStringArray('42')).toEqual([]);
  });

  it('filters out non-string values from a mixed array', () => {
    expect(parseStringArray('["hello", 1, true, null, "world"]')).toEqual(['hello', 'world']);
  });

  it('throws for invalid JSON', () => {
    expect(() => parseStringArray('not json')).toThrow();
  });
});
