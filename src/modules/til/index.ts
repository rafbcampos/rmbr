import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { tilMigrations } from './schema.ts';
import { tilTools } from './tools.ts';
import { registerCommands } from './commands.ts';

export const tilModule: RmbrModule = {
  name: 'til',
  migrations: tilMigrations,
  tools: tilTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
