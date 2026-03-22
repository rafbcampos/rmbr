import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { kudosMigrations } from './schema.ts';
import { kudosTools } from './tools.ts';
import { registerCommands } from './commands.ts';

export const kudosModule: RmbrModule = {
  name: 'kudos',
  migrations: kudosMigrations,
  tools: kudosTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
