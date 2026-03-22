import type { PaginatedResult, PaginationParams } from '../core/types.ts';

export interface PaginationInput<T> {
  readonly data: readonly T[];
  readonly total: number;
}

export function paginateResults<T>(
  input: PaginationInput<T>,
  pagination: PaginationParams,
): PaginatedResult<T> {
  return {
    data: input.data,
    total: input.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(input.total / pagination.pageSize) || 1,
  };
}

export const DEFAULT_PAGINATION: PaginationParams = {
  page: 1,
  pageSize: 20,
};
