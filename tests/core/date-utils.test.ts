import { describe, it, expect } from 'bun:test';
import {
  getQuarterDateRange,
  getWeekBoundaries,
  formatDate,
  getCurrentQuarter,
  getCurrentYear,
  formatDuration,
} from '../../src/core/date-utils.ts';

describe('date-utils', () => {
  describe('getQuarterDateRange', () => {
    it('should return correct Q1 range', () => {
      const range = getQuarterDateRange('Q1', 2026);
      expect(range.start).toBe('2026-01-01');
      expect(range.end).toBe('2026-03-31');
    });

    it('should return correct Q2 range', () => {
      const range = getQuarterDateRange('Q2', 2026);
      expect(range.start).toBe('2026-04-01');
      expect(range.end).toBe('2026-06-30');
    });

    it('should return correct Q3 range', () => {
      const range = getQuarterDateRange('Q3', 2026);
      expect(range.start).toBe('2026-07-01');
      expect(range.end).toBe('2026-09-30');
    });

    it('should return correct Q4 range', () => {
      const range = getQuarterDateRange('Q4', 2026);
      expect(range.start).toBe('2026-10-01');
      expect(range.end).toBe('2026-12-31');
    });
  });

  describe('getWeekBoundaries', () => {
    it('should return Monday to Sunday range', () => {
      const wednesday = new Date('2026-03-18T12:00:00');
      const range = getWeekBoundaries(wednesday);
      expect(range.start).toBe('2026-03-16');
      expect(range.end).toBe('2026-03-22');
    });
  });

  describe('formatDate', () => {
    it('should format a Date object to YYYY-MM-DD', () => {
      expect(formatDate(new Date('2026-03-20T15:30:00Z'))).toBe('2026-03-20');
    });

    it('should format a date string to YYYY-MM-DD', () => {
      expect(formatDate('2026-03-20T15:30:00Z')).toBe('2026-03-20');
    });
  });

  describe('getCurrentQuarter', () => {
    it('should return a valid quarter', () => {
      const q = getCurrentQuarter();
      expect(['Q1', 'Q2', 'Q3', 'Q4']).toContain(q);
    });
  });

  describe('getCurrentYear', () => {
    it('should return current year', () => {
      expect(getCurrentYear()).toBe(new Date().getFullYear());
    });
  });

  describe('formatDuration', () => {
    it('formats 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('formats seconds only', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(312)).toBe('5m 12s');
    });

    it('formats exact minutes', () => {
      expect(formatDuration(300)).toBe('5m');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(9240)).toBe('2h 34m');
    });

    it('formats exact hours', () => {
      expect(formatDuration(3600)).toBe('1h');
    });

    it('accumulates hours beyond 24', () => {
      expect(formatDuration(90061)).toBe('25h 1m');
    });

    it('clamps negative values to 0s', () => {
      expect(formatDuration(-5)).toBe('0s');
    });

    it('floors fractional seconds', () => {
      expect(formatDuration(45.9)).toBe('45s');
    });
  });
});
