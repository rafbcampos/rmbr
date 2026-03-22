import { describe, it, expect } from 'bun:test';
import { parseId } from '../../src/shared/validation.ts';
import { ValidationError } from '../../src/core/errors.ts';

describe('parseId', () => {
  it('returns a number for a valid positive integer string', () => {
    expect(parseId('1', 'todo')).toBe(1);
    expect(parseId('42', 'goal')).toBe(42);
    expect(parseId('999', 'kudos')).toBe(999);
  });

  it('throws ValidationError for zero', () => {
    expect(() => parseId('0', 'todo')).toThrow(ValidationError);
  });

  it('throws ValidationError for a negative number', () => {
    expect(() => parseId('-1', 'todo')).toThrow(ValidationError);
    expect(() => parseId('-100', 'goal')).toThrow(ValidationError);
  });

  it('throws ValidationError for a non-numeric string', () => {
    expect(() => parseId('abc', 'todo')).toThrow(ValidationError);
    expect(() => parseId('twelve', 'goal')).toThrow(ValidationError);
  });

  it('throws ValidationError for a float string', () => {
    expect(() => parseId('3.14', 'todo')).toThrow(ValidationError);
    expect(() => parseId('1.5', 'goal')).toThrow(ValidationError);
  });

  it('throws ValidationError for an empty string', () => {
    expect(() => parseId('', 'todo')).toThrow(ValidationError);
  });

  it('includes the entity name in the error message', () => {
    expect(() => parseId('bad', 'todo')).toThrow(/todo/);
    expect(() => parseId('bad', 'goal')).toThrow(/goal/);
  });
});
