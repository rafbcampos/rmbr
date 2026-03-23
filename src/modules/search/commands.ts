import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import * as SearchService from './service.ts';

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  program
    .command('search <query>')
    .description('Search across all entity types')
    .option('--limit <n>', 'Max results', '20')
    .action((query: string, opts: { limit: string }) => {
      const limit = parseInt(opts.limit, 10);
      const results = SearchService.search(db, query, limit);
      if (results.length === 0) {
        console.log('No results found.');
        return;
      }
      console.log(`Found ${results.length} result(s):`);
      for (const r of results) {
        console.log(`  [${r.entity_type}] #${r.entity_id} ${r.snippet}`);
      }
    });
}
