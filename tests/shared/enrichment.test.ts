import { describe, it, expect } from 'bun:test';
import { toUpdateRecord } from '../../src/shared/enrichment.ts';

describe('toUpdateRecord', () => {
  it('includes defined fields', () => {
    const result = toUpdateRecord({ title: 'hello', priority: 'high' });
    expect(result).toEqual({ title: 'hello', priority: 'high' });
  });

  it('excludes undefined fields', () => {
    const result = toUpdateRecord({ title: 'hello', priority: undefined });
    expect(result).toEqual({ title: 'hello' });
  });

  it('includes null fields', () => {
    const result = toUpdateRecord({ title: null });
    expect(result).toEqual({ title: null });
  });

  it('returns empty record for all undefined fields', () => {
    const result = toUpdateRecord({ title: undefined, priority: undefined });
    expect(result).toEqual({});
  });
});
