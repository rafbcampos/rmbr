import { Command } from 'commander';
import { loadConfig } from './core/config.ts';
import { openDrizzleDatabase } from './core/db.ts';
import { runMigrations } from './core/migrator.ts';
import { createAppRegistry } from './registry.ts';

export async function runCli(): Promise<void> {
  const program = new Command();
  program.name('rmbr').description('CLI second brain for work').version('0.1.0');

  const config = loadConfig();
  const { raw, drizzle: db } = openDrizzleDatabase(config.dbPath);
  const registry = createAppRegistry();

  runMigrations(raw, registry.getAllMigrations());

  for (const mod of registry.getModules()) {
    mod.registerCommands(program, db);
  }

  await program.parseAsync(process.argv);
}
