import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { RmbrModule } from '../../core/module-contract.ts';
import { studyMigrations } from './schema.ts';
import { registerCommands } from './commands.ts';
import { studyTools } from './tools.ts';

export const studyModule: RmbrModule = {
  name: 'study',
  migrations: studyMigrations,
  tools: studyTools,
  registerCommands(program: Command, db: DrizzleDatabase): void {
    registerCommands(program, db);
  },
};
