import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { KudosFilters } from './service.ts';
import { KudosService } from './service.ts';
import { isKudosDirection } from './types.ts';
import { parseId } from '../../shared/validation.ts';

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
    .description('List kudos')
    .option('--direction <direction>', 'Filter by direction (given or received)')
    .option('--page <page>', 'Page number', '1')
    .action((opts: { direction?: string; page?: string }) => {
      const filters: KudosFilters =
        opts.direction !== undefined && isKudosDirection(opts.direction)
          ? { direction: opts.direction }
          : {};
      const page = parseId(opts.page ?? '1', 'page');
      const result = KudosService.list(db, filters, { page, pageSize: 20 });
      console.log(JSON.stringify(result, null, 2));
    });

  kudos
    .command('show')
    .description('Show a single kudos')
    .argument('<id>', 'Kudos ID')
    .action((id: string) => {
      const result = KudosService.getById(db, parseId(id, 'kudos'));
      console.log(JSON.stringify(result, null, 2));
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
        console.log(JSON.stringify(result, null, 2));
      },
    );
}
