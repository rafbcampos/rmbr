import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './core/config.ts';
import { openDrizzleDatabase } from './core/db.ts';
import { runMigrations } from './core/migrator.ts';
import { createAppRegistry } from './registry.ts';
import type { ToolArgs } from './core/module-contract.ts';

function isToolArgs(value: Record<string, unknown>): value is ToolArgs {
  return Object.values(value).every(
    v => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
  );
}

export async function runMcp(): Promise<void> {
  const config = loadConfig();
  const { raw, drizzle: db } = openDrizzleDatabase(config.dbPath);
  const registry = createAppRegistry();

  runMigrations(raw, registry.getAllMigrations());

  const server = new McpServer({
    name: 'rmbr',
    version: '0.1.0',
  });

  for (const tool of registry.getAllTools()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (rawArgs: Record<string, unknown>) => {
        if (!isToolArgs(rawArgs)) {
          return {
            content: [{ type: 'text' as const, text: 'Invalid tool arguments' }],
            isError: true,
          };
        }
        const result = await tool.handler(db, rawArgs);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
