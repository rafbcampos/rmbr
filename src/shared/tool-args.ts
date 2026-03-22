import type { ToolArgs } from '../core/module-contract.ts';
import { ValidationError } from '../core/errors.ts';

export function getString(args: ToolArgs, key: string): string {
  const val = args[key];
  if (typeof val !== 'string') {
    throw new ValidationError(`Expected string for '${key}'`);
  }
  return val;
}

export function getNumber(args: ToolArgs, key: string): number {
  const val = args[key];
  if (typeof val !== 'number') {
    throw new ValidationError(`Expected number for '${key}'`);
  }
  return val;
}
