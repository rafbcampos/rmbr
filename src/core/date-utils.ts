import type { DateRange, Quarter } from './types.ts';

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentQuarter(): Quarter {
  const month = new Date().getMonth();
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getQuarterDateRange(quarter: Quarter, year: number): DateRange {
  const quarterStartMonth: Record<Quarter, number> = {
    Q1: 0,
    Q2: 3,
    Q3: 6,
    Q4: 9,
  };

  const startMonth = quarterStartMonth[quarter];
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);

  return {
    start: toDateString(start),
    end: toDateString(end),
  };
}

export function getWeekBoundaries(date: Date = new Date()): DateRange {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: toDateString(monday),
    end: toDateString(sunday),
  };
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return toDateString(d);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  if (clamped === 0) return '0s';

  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}
