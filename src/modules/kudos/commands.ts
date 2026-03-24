import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { KudosFilters } from './service.ts';
import { KudosService } from './service.ts';
import { isKudosDirection } from './types.ts';
import { parseId } from '../../shared/validation.ts';

function hasFilterFlags(opts: { direction?: string; includeDeleted?: boolean }): boolean {
  return opts.direction !== undefined || opts.includeDeleted === true;
}

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const kudos = program.command('kudos').description('Manage kudos');

  kudos
    .command('add')
    .description('Add a new kudos entry')
    .argument('<input>', 'Raw kudos input')
    .action((input: string) => {
      const result = KudosService.create(db, input);
      console.log(`Kudos created with id ${result.id}`);
    });

  kudos
    .command('list')
    .description('List kudos (interactive TUI by default, plain text with --ai)')
    .option('--direction <direction>', 'Filter by direction (given or received)')
    .option('--include-deleted', 'Include soft-deleted kudos')
    .option('--ai', 'Plain text output for AI agents')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Page size', '20')
    .action(
      async (opts: {
        direction?: string;
        includeDeleted?: boolean;
        ai?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const useTui = opts.ai !== true && !hasFilterFlags(opts) && process.stdout.isTTY === true;

        if (useTui) {
          const { renderKudosApp } = await import('./tui/app.tsx');
          await renderKudosApp(db);
          return;
        }

        const filters: KudosFilters = {
          ...(opts.direction !== undefined && isKudosDirection(opts.direction)
            ? { direction: opts.direction }
            : {}),
          ...(opts.includeDeleted === true ? { includeDeleted: true } : {}),
        };
        const result = KudosService.list(db, filters, {
          page: parseId(opts.page, 'page'),
          pageSize: parseId(opts.pageSize, 'pageSize'),
        });
        console.log(`Kudos (page ${result.page}/${result.totalPages}, total: ${result.total}):`);
        for (const k of result.data) {
          const dirStr = k.direction !== null ? k.direction : '?';
          const personStr = k.person ? `${k.person}: ` : '';
          console.log(`  #${k.id} [${dirStr}] ${personStr}${k.summary ?? k.raw_input}`);
        }
      },
    );

  kudos
    .command('show')
    .description('Show a single kudos')
    .argument('<id>', 'Kudos ID')
    .action((id: string) => {
      const result = KudosService.getById(db, parseId(id, 'kudos'));
      console.log(`Kudos #${result.id} [${result.direction ?? '?'}]`);
      if (result.person) console.log(`  Person: ${result.person}`);
      if (result.summary) console.log(`  Summary: ${result.summary}`);
      if (result.context) console.log(`  Context: ${result.context}`);
      if (result.goal_id) console.log(`  Goal: #${result.goal_id}`);
      console.log(`  Raw: ${result.raw_input}`);
    });

  kudos
    .command('enrich')
    .description('Enrich a kudos entry with structured data')
    .argument('<id>', 'Kudos ID')
    .option('--person <person>', 'Person name')
    .option('--direction <direction>', 'Direction (given or received)')
    .option('--summary <summary>', 'Summary')
    .option('--context <context>', 'Context')
    .option('--goal-id <goalId>', 'Goal ID')
    .action(
      (
        id: string,
        opts: {
          person?: string;
          direction?: string;
          summary?: string;
          context?: string;
          goalId?: string;
        },
      ) => {
        const fields: Record<string, string | number> = {};
        if (opts.direction !== undefined) {
          fields['direction'] = opts.direction;
        }
        if (opts.person !== undefined) {
          fields['person'] = opts.person;
        }
        if (opts.summary !== undefined) {
          fields['summary'] = opts.summary;
        }
        if (opts.context !== undefined) {
          fields['context'] = opts.context;
        }
        if (opts.goalId !== undefined) {
          fields['goal_id'] = parseId(opts.goalId, 'goal');
        }
        const result = KudosService.enrich(db, parseId(id, 'kudos'), fields);
        console.log(`Enriched kudos #${result.id}: ${result.summary ?? result.raw_input}`);
      },
    );

  kudos
    .command('delete')
    .description('Soft-delete a kudos entry')
    .argument('<id>', 'Kudos ID')
    .action((id: string) => {
      KudosService.softDeleteEntity(db, parseId(id, 'kudos'));
      console.log(`Kudos #${id} soft-deleted`);
    });

  kudos
    .command('restore')
    .description('Restore a soft-deleted kudos entry')
    .argument('<id>', 'Kudos ID')
    .action((id: string) => {
      KudosService.restoreEntity(db, parseId(id, 'kudos'));
      console.log(`Kudos #${id} restored`);
    });
}
