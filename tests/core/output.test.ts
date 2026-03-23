import { describe, it, expect } from 'bun:test';
import { formatTable, formatPaginationInfo } from '../../src/core/output.ts';
import type { PaginatedResult } from '../../src/core/types.ts';

describe('output', () => {
  describe('formatTable', () => {
    it('should format a basic table with aligned columns', () => {
      const headers: readonly string[] = ['ID', 'Name', 'Status'];
      const rows: readonly (readonly string[])[] = [
        ['1', 'Fix bug', 'open'],
        ['2', 'Write docs', 'done'],
      ];

      const result = formatTable(headers, rows);
      const lines = result.split('\n');

      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('ID  Name        Status');
      expect(lines[1]).toBe('--  ----------  ------');
      expect(lines[2]).toBe('1   Fix bug     open  ');
      expect(lines[3]).toBe('2   Write docs  done  ');
    });

    it('should handle varying column widths based on content', () => {
      const headers: readonly string[] = ['A', 'B'];
      const rows: readonly (readonly string[])[] = [
        ['short', 'x'],
        ['a', 'longer value'],
      ];

      const result = formatTable(headers, rows);
      const lines = result.split('\n');

      expect(lines[0]).toBe('A      B           ');
      expect(lines[1]).toBe('-----  ------------');
      expect(lines[2]).toBe('short  x           ');
      expect(lines[3]).toBe('a      longer value');
    });

    it('should handle a single row', () => {
      const headers: readonly string[] = ['Name'];
      const rows: readonly (readonly string[])[] = [['Alice']];

      const result = formatTable(headers, rows);
      const lines = result.split('\n');

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Name ');
      expect(lines[1]).toBe('-----');
      expect(lines[2]).toBe('Alice');
    });
  });

  describe('formatPaginationInfo', () => {
    it('should format pagination as "Page X/Y (Z total)"', () => {
      const result: PaginatedResult<string> = {
        data: ['a', 'b'],
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      };

      expect(formatPaginationInfo(result)).toBe('Page 2/3 (25 total)');
    });

    it('should handle single page results', () => {
      const result: PaginatedResult<number> = {
        data: [1],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      expect(formatPaginationInfo(result)).toBe('Page 1/1 (1 total)');
    });
  });
});
