import type { Command } from 'commander';
import type { Migration } from './migrator.ts';
import type { ZodType } from 'zod';
import type { DrizzleDatabase } from './drizzle.ts';

export type ToolArgs = Record<string, string | number | boolean | null>;

export interface ToolResult {
  [key: string]: string | number | boolean | null | ToolResult | ToolResult[];
}

export interface McpToolAnnotations {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
}

export interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, ZodType>;
  readonly annotations?: McpToolAnnotations;
  readonly handler: (db: DrizzleDatabase, args: ToolArgs) => Promise<ToolResult>;
}

export interface RmbrModule {
  readonly name: string;
  readonly migrations: readonly Migration[];
  readonly tools: readonly McpToolDefinition[];
  registerCommands(program: Command, db: DrizzleDatabase): void;
}
