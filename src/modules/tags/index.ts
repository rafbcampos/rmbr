import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { tagsMigrations } from './schema.ts';
import { tagsTools } from './tools.ts';
import { registerCommands } from './commands.ts';

export const tagsModule: RmbrModule = {
  name: 'tags',
  migrations: tagsMigrations,
  tools: tagsTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
