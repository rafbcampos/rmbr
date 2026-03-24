import type { EditValues } from './edit-form.tsx';

export function pickString(values: EditValues, key: string): string | undefined {
  const v = values[key];
  return typeof v === 'string' ? v : undefined;
}

export function pickNumber(values: EditValues, key: string): number | undefined {
  const v = values[key];
  return typeof v === 'number' ? v : undefined;
}
