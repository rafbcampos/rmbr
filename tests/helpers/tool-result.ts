import type { ToolResult } from '../../src/core/module-contract.ts';

export function getDataArray(result: ToolResult): ToolResult[] {
  const data = result.data;
  if (!Array.isArray(data)) {
    throw new Error(`Expected data to be an array, got ${typeof data}`);
  }
  return data;
}

export function getStringField(result: ToolResult, field: string): string {
  const value = result[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string, got ${typeof value}`);
  }
  return value;
}

export function parseJsonStringArray(json: string): string[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array, got ${typeof parsed}`);
  }
  for (const item of parsed) {
    if (typeof item !== 'string') {
      throw new Error(`Expected string array element, got ${typeof item}`);
    }
  }
  return parsed;
}
