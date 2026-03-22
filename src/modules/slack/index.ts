import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { slackMigrations } from './schema.ts';
import { slackTools } from './tools.ts';
import { registerCommands } from './commands.ts';

export const slackModule: RmbrModule = {
  name: 'slack',
  migrations: slackMigrations,
  tools: slackTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
