import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { goalsMigrations } from './schema.ts';
import { goalsTools } from './tools.ts';
import { registerCommands } from './commands.ts';

export const goalsModule: RmbrModule = {
  name: 'goals',
  migrations: goalsMigrations,
  tools: goalsTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
