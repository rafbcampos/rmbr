import type { ToolArgs } from '../core/module-contract.ts';
import type { PaginationParams } from '../core/types.ts';
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

interface FieldSpec {
  readonly name: string;
  readonly type: 'string' | 'number';
}

export function extractFields(
  args: ToolArgs,
  specs: readonly FieldSpec[],
): { hasEnrichment: boolean; fields: Record<string, string | number> } {
  const fields: Record<string, string | number> = {};
  let hasEnrichment = false;
  for (const spec of specs) {
    const val = args[spec.name];
    if (spec.type === 'string' && typeof val === 'string') {
      fields[spec.name] = val;
      hasEnrichment = true;
    } else if (spec.type === 'number' && typeof val === 'number') {
      fields[spec.name] = val;
      hasEnrichment = true;
    }
  }
  return { hasEnrichment, fields };
}

export function extractPagination(args: ToolArgs): PaginationParams | undefined {
  const page = args.page;
  const pageSize = args.page_size;
  if (typeof page === 'number' || typeof pageSize === 'number') {
    return {
      page: typeof page === 'number' ? page : 1,
      pageSize: typeof pageSize === 'number' ? pageSize : 20,
    };
  }
  return undefined;
}
