import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { todoMigrations } from './schema.ts';
import { registerCommands } from './commands.ts';
import { todoTools } from './tools.ts';

export const todoModule: RmbrModule = {
  name: 'todo',
  migrations: todoMigrations,
  tools: todoTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
