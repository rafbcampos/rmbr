import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { TilFilters } from './service.ts';
import { TilService } from './service.ts';
import { parseId } from '../../shared/validation.ts';
import { parseStringArray } from '../../shared/json-array.ts';

function hasFilterFlags(opts: { domain?: string; includeDeleted?: boolean }): boolean {
  return opts.domain !== undefined || opts.includeDeleted === true;
}

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
    .description('List TIL entries (interactive TUI by default, plain text with --ai)')
    .option('--domain <domain>', 'Filter by domain')
    .option('--include-deleted', 'Include soft-deleted TIL entries')
    .option('--ai', 'Plain text output for AI agents')
    .option('--page <page>', 'Page number', '1')
    .option('--page-size <n>', 'Page size', '20')
    .action(
      async (opts: {
        domain?: string;
        includeDeleted?: boolean;
        ai?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const useTui = opts.ai !== true && !hasFilterFlags(opts) && process.stdout.isTTY === true;

        if (useTui) {
          const { renderTilApp } = await import('./tui/app.tsx');
          await renderTilApp(db);
          return;
        }

        const filters: TilFilters = {
          ...(opts.domain !== undefined ? { domain: opts.domain } : {}),
          ...(opts.includeDeleted === true ? { includeDeleted: true } : {}),
        };
        const result = TilService.list(db, filters, {
          page: parseId(opts.page, 'page'),
          pageSize: parseId(opts.pageSize, 'pageSize'),
        });
        console.log(`TILs (page ${result.page}/${result.totalPages}, total: ${result.total}):`);
        for (const t of result.data) {
          const domainStr = t.domain !== null ? t.domain : '?';
          const tagsCount = parseStringArray(t.tags).length;
          const tagsStr = tagsCount > 0 ? ` (${tagsCount} tags)` : '';
          console.log(`  #${t.id} [${domainStr}] ${t.title ?? t.raw_input}${tagsStr}`);
        }
      },
    );

  til
    .command('show')
    .description('Show a single TIL entry')
    .argument('<id>', 'TIL ID')
    .action((id: string) => {
      const result = TilService.getById(db, parseId(id, 'til'));
      console.log(`TIL #${result.id} [${result.domain ?? '?'}]`);
      if (result.title) console.log(`  Title: ${result.title}`);
      if (result.content) console.log(`  Content: ${result.content}`);
      const tags = parseStringArray(result.tags);
      if (tags.length > 0) console.log(`  Tags: ${tags.join(', ')}`);
      console.log(`  Raw: ${result.raw_input}`);
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

  til
    .command('delete')
    .description('Soft-delete a TIL entry')
    .argument('<id>', 'TIL ID')
    .action((id: string) => {
      TilService.softDeleteEntity(db, parseId(id, 'til'));
      console.log(`TIL #${id} soft-deleted`);
    });

  til
    .command('restore')
    .description('Restore a soft-deleted TIL entry')
    .argument('<id>', 'TIL ID')
    .action((id: string) => {
      TilService.restoreEntity(db, parseId(id, 'til'));
      console.log(`TIL #${id} restored`);
    });
}
