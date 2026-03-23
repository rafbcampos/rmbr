import type { ToolResult } from '../core/module-contract.ts';
import type { PaginatedResult, ToolSerializable } from '../core/types.ts';

export function entityToToolResult<T extends ToolSerializable>(entity: T): ToolResult {
  const result: ToolResult = {};
  for (const key in entity) {
    if (Object.prototype.hasOwnProperty.call(entity, key)) {
      const value = entity[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function paginatedToToolResult<T extends ToolSerializable>(
  result: PaginatedResult<T>,
): ToolResult {
  return {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    data: result.data.map(entityToToolResult),
  };
}
