import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { GoalStatus } from '../../core/types.ts';
import { GoalService } from './service.ts';
import { isGoalStatus, isQuarter } from './types.ts';
import { parseId } from '../../shared/validation.ts';
import { parseStringArray } from '../../shared/json-array.ts';

function hasFilterFlags(opts: {
  status?: string;
  quarter?: string;
  year?: string;
  includeDeleted?: boolean;
}): boolean {
  return (
    opts.status !== undefined ||
    opts.quarter !== undefined ||
    opts.year !== undefined ||
    opts.includeDeleted === true
  );
}

function formatGoalLine(g: {
  readonly id: number;
  readonly status: string;
  readonly title: string | null;
  readonly raw_input: string;
  readonly quarter: string | null;
  readonly year: number | null;
  readonly kpis: string;
}): string {
  const label = g.title ?? g.raw_input;
  const quarterStr = g.quarter !== null && g.year !== null ? `  ${g.quarter} ${g.year}` : '';
  const kpiCount = parseStringArray(g.kpis).length;
  const kpiStr = kpiCount > 0 ? `  ${kpiCount} KPIs` : '';
  return `  #${g.id} [${g.status}] ${label}${quarterStr}${kpiStr}`;
}

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
    .description('List goals (interactive TUI by default, plain text with --ai)')
    .option('-s, --status <status>', 'Filter by status')
    .option('-q, --quarter <quarter>', 'Filter by quarter (Q1-Q4)')
    .option('-y, --year <year>', 'Filter by year')
    .option('--include-deleted', 'Include soft-deleted goals')
    .option('--ai', 'Plain text output for AI agents')
    .option('-p, --page <page>', 'Page number', '1')
    .option('--page-size <size>', 'Page size', '20')
    .action(
      async (opts: {
        status?: string;
        quarter?: string;
        year?: string;
        includeDeleted?: boolean;
        ai?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const useTui = opts.ai !== true && !hasFilterFlags(opts) && process.stdout.isTTY === true;

        if (useTui) {
          const { renderGoalApp } = await import('./tui/app.tsx');
          await renderGoalApp(db);
          return;
        }

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
        console.log(`Goals (page ${result.page}/${result.totalPages}, total: ${result.total}):`);
        for (const g of result.data) {
          console.log(formatGoalLine(g));
        }
      },
    );

  goal
    .command('show')
    .description('Show a goal')
    .argument('<id>', 'Goal ID')
    .action((id: string) => {
      const g = GoalService.getById(db, parseId(id, 'goal'));
      console.log(`Goal #${g.id} [${g.status}] ${g.title ?? g.raw_input}`);
      if (g.quarter !== null && g.year !== null) console.log(`  Quarter: ${g.quarter} ${g.year}`);
      const kpis = parseStringArray(g.kpis);
      if (kpis.length > 0) {
        console.log(`  KPIs:`);
        for (const kpi of kpis) {
          console.log(`    - ${kpi}`);
        }
      }
      console.log(`  Enrichment: ${g.enrichment_status}`);
      console.log(`  Created: ${g.created_at}`);
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
        console.log(`Enriched goal #${updated.id}: ${updated.title ?? updated.raw_input}`);
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
      console.log(`Quarterly Review: ${opts.quarter} ${opts.year}`);
      console.log(`Goals (${data.goals.length}):`);
      for (const g of data.goals) {
        console.log(formatGoalLine(g));
      }
      console.log(`STAR Narratives (${data.starNarratives.length}):`);
      for (const s of data.starNarratives) {
        console.log(
          `  Goal #${s.goal_id}: S=${s.situation} T=${s.task} A=${s.action} R=${s.result}`,
        );
      }
      if (data.existingReview) {
        console.log(`Existing Review: #${data.existingReview.id}`);
      }
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
      const goalId = parseId(id, 'goal');
      const related = GoalService.getRelatedEntities(db, goalId);
      console.log(`Related entities for goal #${goalId}:`);
      if (related.todos.length > 0) {
        console.log(`  Todos (${related.todos.length}):`);
        for (const t of related.todos) {
          console.log(`    #${t.id} [${t.status}] ${t.title ?? t.raw_input}`);
        }
      }
      if (related.kudos.length > 0) {
        console.log(`  Kudos (${related.kudos.length}):`);
        for (const k of related.kudos) {
          console.log(`    #${k.id} ${k.title ?? k.raw_input}`);
        }
      }
      if (related.studyTopics.length > 0) {
        console.log(`  Study Topics (${related.studyTopics.length}):`);
        for (const s of related.studyTopics) {
          console.log(`    #${s.id} ${s.title ?? s.raw_input}`);
        }
      }
      if (related.slackMessages.length > 0) {
        console.log(`  Slack Messages (${related.slackMessages.length}):`);
        for (const m of related.slackMessages) {
          console.log(`    #${m.id} ${m.raw_input}`);
        }
      }
    });
}
