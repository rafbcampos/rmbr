import { ValidationError } from '../core/errors.ts';

export function parseId(value: string, entityName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`Invalid ${entityName} ID: '${value}'. Must be a positive integer.`);
  }
  return parsed;
}
