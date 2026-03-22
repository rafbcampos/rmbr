import { describe, it, expect } from 'bun:test';
import { getString, getNumber } from '../../src/shared/tool-args.ts';
import { ValidationError } from '../../src/core/errors.ts';

describe('getString', () => {
  it('returns the string value for a valid key', () => {
    const args = { name: 'Alice' };
    expect(getString(args, 'name')).toBe('Alice');
  });

  it('throws ValidationError when value is a number', () => {
    const args = { count: 42 };
    expect(() => getString(args, 'count')).toThrow(ValidationError);
  });

  it('throws ValidationError when key is missing', () => {
    const args = {};
    expect(() => getString(args, 'name')).toThrow(ValidationError);
  });
});

describe('getNumber', () => {
  it('returns the number value for a valid key', () => {
    const args = { count: 42 };
    expect(getNumber(args, 'count')).toBe(42);
  });

  it('throws ValidationError when value is a string', () => {
    const args = { count: 'forty-two' };
    expect(() => getNumber(args, 'count')).toThrow(ValidationError);
  });

  it('throws ValidationError when key is missing', () => {
    const args = {};
    expect(() => getNumber(args, 'count')).toThrow(ValidationError);
  });
});
