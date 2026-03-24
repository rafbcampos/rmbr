import { describe, it, expect } from 'bun:test';
import { formatValue } from '../../../src/shared/tui/detail-pane.tsx';

describe('formatValue', () => {
  it('returns "—" for null', () => {
    expect(formatValue(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatValue(undefined)).toBe('—');
  });

  it('returns "yes" for true', () => {
    expect(formatValue(true)).toBe('yes');
  });

  it('returns "no" for false', () => {
    expect(formatValue(false)).toBe('no');
  });

  it('returns "—" for empty string', () => {
    expect(formatValue('')).toBe('—');
  });

  it('returns "—" for "[]"', () => {
    expect(formatValue('[]')).toBe('—');
  });

  it('returns the string for a plain string', () => {
    expect(formatValue('hello')).toBe('hello');
  });

  it('returns stringified number for a number', () => {
    expect(formatValue(42)).toBe('42');
  });

  it('joins parsed JSON array of strings', () => {
    expect(formatValue('["a","b"]')).toBe('a, b');
  });

  it('returns dash for JSON array of non-string items', () => {
    expect(formatValue('[1,2,3]')).toBe('—');
  });

  it('returns the raw string for invalid JSON starting with [', () => {
    expect(formatValue('not json [')).toBe('not json [');
  });
});
