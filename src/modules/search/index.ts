import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { searchTools } from './tools.ts';
import { registerCommands } from './commands.ts';

export const searchModule: RmbrModule = {
  name: 'search',
  migrations: [],
  tools: searchTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
