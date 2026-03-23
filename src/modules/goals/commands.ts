import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { GoalStatus } from '../../core/types.ts';
import { GoalService } from './service.ts';
import { isGoalStatus, isQuarter } from './types.ts';
import { parseId } from '../../shared/validation.ts';

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const goal = program.command('goal').description('Manage goals');

  goal
    .command('add')
    .description('Add a new goal')
    .argument('<input>', 'Goal description')
    .action((input: string) => {
      const created = GoalService.create(db, input);
      console.log(`Goal created with id ${created.id}`);
    });

  goal
    .command('list')
    .description('List goals')
    .option('-s, --status <status>', 'Filter by status')
    .option('-q, --quarter <quarter>', 'Filter by quarter (Q1-Q4)')
    .option('-y, --year <year>', 'Filter by year')
    .option('--include-deleted', 'Include soft-deleted goals')
    .option('-p, --page <page>', 'Page number', '1')
    .option('--page-size <size>', 'Page size', '20')
    .action(
      (opts: {
        status?: string;
        quarter?: string;
        year?: string;
        includeDeleted?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const filters = {
          status: opts.status && isGoalStatus(opts.status) ? opts.status : undefined,
          quarter: opts.quarter && isQuarter(opts.quarter) ? opts.quarter : undefined,
          year: opts.year ? parseId(opts.year, 'year') : undefined,
          includeDeleted: opts.includeDeleted === true ? true : undefined,
        };
        const result = GoalService.list(db, filters, {
          page: parseId(opts.page, 'page'),
          pageSize: parseId(opts.pageSize, 'pageSize'),
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  goal
    .command('show')
    .description('Show a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      const found = GoalService.getById(db, parseId(id, 'goal'));
      console.log(JSON.stringify(found, null, 2));
    });

  goal
    .command('activate')
    .description('Activate a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      const updated = GoalService.transition(db, parseId(id, 'goal'), GoalStatus.Active);
      console.log(`Goal ${updated.id} is now active`);
    });

  goal
    .command('complete')
    .description('Complete a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      const updated = GoalService.transition(db, parseId(id, 'goal'), GoalStatus.Completed);
      console.log(`Goal ${updated.id} is now completed`);
    });

  goal
    .command('abandon')
    .description('Abandon a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      const updated = GoalService.transition(db, parseId(id, 'goal'), GoalStatus.Abandoned);
      console.log(`Goal ${updated.id} is now abandoned`);
    });

  goal
    .command('enrich')
    .description('Enrich a goal with details')
    .argument('<id>', 'Goal ID')
    .option('-t, --title <title>', 'Goal title')
    .option('-q, --quarter <quarter>', 'Quarter (Q1-Q4)')
    .option('-y, --year <year>', 'Year')
    .option('-k, --kpis <kpis>', 'KPIs as JSON array')
    .action(
      (id: string, opts: { title?: string; quarter?: string; year?: string; kpis?: string }) => {
        const fields: Record<string, string | number> = {};
        if (opts.title) fields['title'] = opts.title;
        if (opts.quarter) fields['quarter'] = opts.quarter;
        if (opts.year) fields['year'] = parseId(opts.year, 'year');
        if (opts.kpis) fields['kpis'] = opts.kpis;
        const updated = GoalService.enrich(db, parseId(id, 'goal'), fields);
        console.log(JSON.stringify(updated, null, 2));
      },
    );

  goal
    .command('star')
    .description('Add a STAR narrative to a goal')
    .argument('<id>', 'Goal ID')
    .requiredOption('--situation <situation>', 'Situation')
    .requiredOption('--task <task>', 'Task')
    .requiredOption('--action <action>', 'Action')
    .requiredOption('--result <result>', 'Result')
    .action(
      (id: string, opts: { situation: string; task: string; action: string; result: string }) => {
        const narrative = GoalService.addStarNarrative(db, parseId(id, 'goal'), {
          situation: opts.situation,
          task: opts.task,
          action: opts.action,
          result: opts.result,
        });
        console.log(`STAR narrative ${narrative.id} added to goal ${id}`);
      },
    );

  goal
    .command('review')
    .description('Get quarterly review data')
    .requiredOption('-q, --quarter <quarter>', 'Quarter (Q1-Q4)')
    .requiredOption('-y, --year <year>', 'Year')
    .action((opts: { quarter: string; year: string }) => {
      if (!isQuarter(opts.quarter)) {
        console.error(`Invalid quarter: ${opts.quarter}`);
        return;
      }
      const data = GoalService.getQuarterlyReviewData(db, opts.quarter, parseId(opts.year, 'year'));
      console.log(JSON.stringify(data, null, 2));
    });

  goal
    .command('delete')
    .description('Soft-delete a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      GoalService.softDeleteEntity(db, parseId(id, 'goal'));
      console.log(`Goal #${id} soft-deleted`);
    });

  goal
    .command('restore')
    .description('Restore a soft-deleted goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      GoalService.restoreEntity(db, parseId(id, 'goal'));
      console.log(`Goal #${id} restored`);
    });

  goal
    .command('related')
    .description('Show all entities related to a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      const related = GoalService.getRelatedEntities(db, parseId(id, 'goal'));
      console.log(JSON.stringify(related, null, 2));
    });
}
