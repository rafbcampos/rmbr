import type { PaginatedResult } from './types.ts';

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)));

  const headerLine = headers.map((h, i) => h.padEnd(widths[i]!)).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');
  const bodyLines = rows.map(row => row.map((c, i) => c.padEnd(widths[i]!)).join('  '));

  return [headerLine, separator, ...bodyLines].join('\n');
}

export function formatPaginationInfo<T>(result: PaginatedResult<T>): string {
  return `Page ${result.page}/${result.totalPages} (${result.total} total)`;
}

export function printSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

export function printError(message: string): void {
  console.error(`✗ ${message}`);
}

export function printJson(data: object): void {
  console.log(JSON.stringify(data, null, 2));
}
