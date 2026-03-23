import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './core/config.ts';
import { openDrizzleDatabase } from './core/db.ts';
import { runMigrations } from './core/migrator.ts';
import { createAppRegistry } from './registry.ts';
import type { ToolArgs } from './core/module-contract.ts';

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
      async rawArgs => {
        const validated: ToolArgs = {};
        let valid = true;
        for (const [key, val] of Object.entries(rawArgs)) {
          if (
            val === null ||
            typeof val === 'string' ||
            typeof val === 'number' ||
            typeof val === 'boolean'
          ) {
            validated[key] = val;
          } else {
            valid = false;
            break;
          }
        }
        if (!valid) {
          return {
            content: [{ type: 'text', text: 'Invalid tool arguments' }],
            isError: true,
          };
        }
        const result = await tool.handler(db, validated);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
