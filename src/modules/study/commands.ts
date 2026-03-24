import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { StudyStatus } from '../../core/types.ts';
import { StudyService } from './service.ts';
import { parseStudyStatus } from './types.ts';
import { parseStringArray } from '../../shared/json-array.ts';
import { parseId } from '../../shared/validation.ts';

function hasFilterFlags(opts: {
  status?: string;
  domain?: string;
  includeDeleted?: boolean;
}): boolean {
  return opts.status !== undefined || opts.domain !== undefined || opts.includeDeleted === true;
}

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const study = program.command('study').description('Manage study topics');

  study
    .command('add <input>')
    .description('Create a new study topic from raw input')
    .action((input: string) => {
      const created = StudyService.create(db, input);
      console.log(`Created study topic #${created.id}: ${created.raw_input}`);
    });

  study
    .command('list')
    .description('List study topics (interactive TUI by default, plain text with --ai)')
    .option('--status <status>', 'Filter by status')
    .option('--domain <domain>', 'Filter by domain')
    .option('--include-deleted', 'Include soft-deleted study topics')
    .option('--ai', 'Plain text output for AI agents')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Page size', '20')
    .action(
      async (opts: {
        status?: string;
        domain?: string;
        includeDeleted?: boolean;
        ai?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const useTui = opts.ai !== true && !hasFilterFlags(opts) && process.stdout.isTTY === true;

        if (useTui) {
          const { renderStudyApp } = await import('./tui/app.tsx');
          await renderStudyApp(db);
          return;
        }

        const filtersToPass = {
          ...(opts.status ? { status: parseStudyStatus(opts.status) } : {}),
          ...(opts.domain ? { domain: opts.domain } : {}),
          ...(opts.includeDeleted === true ? { includeDeleted: true } : {}),
        };
        const result = StudyService.list(db, filtersToPass, {
          page: parseId(opts.page, 'page'),
          pageSize: parseId(opts.pageSize, 'pageSize'),
        });
        console.log(
          `Study topics (page ${result.page}/${result.totalPages}, total: ${result.total}):`,
        );
        for (const t of result.data) {
          console.log(`  #${t.id} [${t.status}] ${t.title ?? t.raw_input}`);
        }
      },
    );

  study
    .command('show <id>')
    .description('Show a single study topic')
    .action((id: string) => {
      const t = StudyService.getById(db, parseId(id, 'study topic'));
      console.log(JSON.stringify(t, null, 2));
    });

  study
    .command('start <id>')
    .description('Start studying a topic (transition to in_progress)')
    .action((id: string) => {
      const t = StudyService.transition(db, parseId(id, 'study topic'), StudyStatus.InProgress);
      console.log(`Study topic #${t.id} is now in_progress`);
    });

  study
    .command('done <id>')
    .description('Mark a study topic as completed')
    .action((id: string) => {
      const t = StudyService.transition(db, parseId(id, 'study topic'), StudyStatus.Completed);
      console.log(`Study topic #${t.id} is now completed`);
    });

  study
    .command('park <id>')
    .description('Park a study topic')
    .action((id: string) => {
      const t = StudyService.transition(db, parseId(id, 'study topic'), StudyStatus.Parked);
      console.log(`Study topic #${t.id} is now parked`);
    });

  study
    .command('note <id> <note>')
    .description('Add a note to a study topic')
    .action((id: string, note: string) => {
      const t = StudyService.addNote(db, parseId(id, 'study topic'), note);
      const notes = parseStringArray(t.notes);
      console.log(`Added note to study topic #${t.id} (${notes.length} notes total)`);
    });

  study
    .command('resource <id> <url>')
    .description('Add a resource URL to a study topic')
    .action((id: string, url: string) => {
      const t = StudyService.addResource(db, parseId(id, 'study topic'), url);
      const resources = parseStringArray(t.resources);
      console.log(`Added resource to study topic #${t.id} (${resources.length} resources total)`);
    });

  study
    .command('next')
    .description('Show the next queued study topic')
    .action(() => {
      const t = StudyService.getNext(db);
      if (!t) {
        console.log('No queued study topics');
        return;
      }
      console.log(`Next study topic: #${t.id} ${t.title ?? t.raw_input}`);
    });

  study
    .command('enrich <id>')
    .description('Enrich a study topic with structured data')
    .option('--title <title>', 'Topic title')
    .option('--domain <domain>', 'Study domain')
    .option('--goal-id <id>', 'Associated goal ID')
    .action((id: string, opts: { title?: string; domain?: string; goalId?: string }) => {
      const t = StudyService.enrich(db, parseId(id, 'study topic'), {
        title: opts.title,
        domain: opts.domain,
        goal_id: opts.goalId ? parseId(opts.goalId, 'goal') : undefined,
      });
      console.log(`Enriched study topic #${t.id}: ${t.title}`);
    });

  study
    .command('delete <id>')
    .description('Soft-delete a study topic')
    .action((id: string) => {
      StudyService.softDeleteEntity(db, parseId(id, 'study topic'));
      console.log(`Study topic #${id} soft-deleted`);
    });

  study
    .command('restore <id>')
    .description('Restore a soft-deleted study topic')
    .action((id: string) => {
      StudyService.restoreEntity(db, parseId(id, 'study topic'));
      console.log(`Study topic #${id} restored`);
    });
}
