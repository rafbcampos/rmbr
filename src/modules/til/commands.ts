import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { TilFilters } from './service.ts';
import { TilService } from './service.ts';
import { parseId } from '../../shared/validation.ts';

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const til = program.command('til').description('Manage today-I-learned entries');

  til
    .command('add')
    .description('Add a new TIL entry')
    .argument('<input>', 'Raw TIL input')
    .action((input: string) => {
      const result = TilService.create(db, input);
      console.log(`TIL created with id ${result.id}`);
    });

  til
    .command('list')
    .description('List TIL entries')
    .option('--domain <domain>', 'Filter by domain')
    .option('--page <page>', 'Page number', '1')
    .action((opts: { domain?: string; page?: string }) => {
      const filters: TilFilters = opts.domain !== undefined ? { domain: opts.domain } : {};
      const page = parseId(opts.page ?? '1', 'page');
      const result = TilService.list(db, filters, { page, pageSize: 20 });
      console.log(JSON.stringify(result, null, 2));
    });

  til
    .command('show')
    .description('Show a single TIL entry')
    .argument('<id>', 'TIL ID')
    .action((id: string) => {
      const result = TilService.getById(db, parseId(id, 'til'));
      console.log(JSON.stringify(result, null, 2));
    });

  til
    .command('search')
    .description('Full-text search TIL entries')
    .argument('<query>', 'Search query')
    .action((query: string) => {
      const results = TilService.search(db, query);
      console.log(JSON.stringify(results, null, 2));
    });

  til
    .command('domains')
    .description('List all TIL domains')
    .action(() => {
      const domains = TilService.getDomains(db);
      console.log(JSON.stringify(domains, null, 2));
    });

  til
    .command('enrich')
    .description('Enrich a TIL entry with structured data')
    .argument('<id>', 'TIL ID')
    .option('--title <title>', 'Title')
    .option('--content <content>', 'Content')
    .option('--domain <domain>', 'Domain')
    .option('--tags <tags>', 'Tags (JSON array)')
    .action(
      (id: string, opts: { title?: string; content?: string; domain?: string; tags?: string }) => {
        const fields: Record<string, string> = {};
        if (opts.title !== undefined) {
          fields['title'] = opts.title;
        }
        if (opts.content !== undefined) {
          fields['content'] = opts.content;
        }
        if (opts.domain !== undefined) {
          fields['domain'] = opts.domain;
        }
        if (opts.tags !== undefined) {
          fields['tags'] = opts.tags;
        }
        const result = TilService.enrich(db, parseId(id, 'til'), fields);
        console.log(JSON.stringify(result, null, 2));
      },
    );
}
