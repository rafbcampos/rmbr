import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { TodoStatus } from '../../core/types.ts';
import { TodoService } from './service.ts';
import { parseTodoStatus } from './types.ts';
import { parseId } from '../../shared/validation.ts';

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const todo = program.command('todo').description('Manage todos');

  todo
    .command('add <input>')
    .description('Create a new todo from raw input')
    .action((input: string) => {
      const created = TodoService.create(db, input);
      console.log(`Created todo #${created.id}: ${created.raw_input}`);
    });

  todo
    .command('list')
    .description('List todos')
    .option('--status <status>', 'Filter by status')
    .option('--overdue', 'Show overdue todos')
    .option('--due-today', 'Show todos due today')
    .option('--due-this-week', 'Show todos due this week')
    .option('--include-deleted', 'Include soft-deleted todos')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Page size', '20')
    .action(
      (opts: {
        status?: string;
        overdue?: boolean;
        dueToday?: boolean;
        dueThisWeek?: boolean;
        includeDeleted?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const filters = {
          ...(opts.status ? { status: parseTodoStatus(opts.status) } : {}),
          ...(opts.overdue === true ? { overdue: true } : {}),
          ...(opts.dueToday === true ? { dueToday: true } : {}),
          ...(opts.dueThisWeek === true ? { dueThisWeek: true } : {}),
          ...(opts.includeDeleted === true ? { includeDeleted: true } : {}),
        };
        const result = TodoService.list(db, filters, {
          page: parseId(opts.page, 'page'),
          pageSize: parseId(opts.pageSize, 'pageSize'),
        });
        console.log(`Todos (page ${result.page}/${result.totalPages}, total: ${result.total}):`);
        for (const t of result.data) {
          console.log(`  #${t.id} [${t.status}] ${t.title ?? t.raw_input}`);
        }
      },
    );

  todo
    .command('show <id>')
    .description('Show a single todo')
    .action((id: string) => {
      const t = TodoService.getById(db, parseId(id, 'todo'));
      console.log(JSON.stringify(t, null, 2));
    });

  todo
    .command('start <id>')
    .description('Start a todo (transition to in_progress)')
    .action((id: string) => {
      const t = TodoService.transition(db, parseId(id, 'todo'), TodoStatus.InProgress);
      console.log(`Todo #${t.id} is now in_progress`);
    });

  todo
    .command('pause <id>')
    .description('Pause a todo')
    .action((id: string) => {
      const t = TodoService.transition(db, parseId(id, 'todo'), TodoStatus.Paused);
      console.log(`Todo #${t.id} is now paused`);
    });

  todo
    .command('done <id>')
    .description('Mark a todo as done')
    .action((id: string) => {
      const t = TodoService.transition(db, parseId(id, 'todo'), TodoStatus.Done);
      console.log(`Todo #${t.id} is now done`);
    });

  todo
    .command('cancel <id>')
    .description('Cancel a todo')
    .action((id: string) => {
      const t = TodoService.transition(db, parseId(id, 'todo'), TodoStatus.Cancelled);
      console.log(`Todo #${t.id} is now cancelled`);
    });

  todo
    .command('enrich <id>')
    .description('Enrich a todo with structured data')
    .requiredOption('--title <title>', 'Todo title')
    .option('--priority <priority>', 'Priority level')
    .option('--due-date <date>', 'Due date')
    .option('--goal-id <id>', 'Associated goal ID')
    .action(
      (
        id: string,
        opts: { title: string; priority?: string; dueDate?: string; goalId?: string },
      ) => {
        const t = TodoService.enrich(db, parseId(id, 'todo'), {
          title: opts.title,
          priority: opts.priority,
          due_date: opts.dueDate,
          goal_id: opts.goalId ? parseId(opts.goalId, 'goal') : undefined,
        });
        console.log(`Enriched todo #${t.id}: ${t.title}`);
      },
    );

  todo
    .command('delete <id>')
    .description('Soft-delete a todo')
    .action((id: string) => {
      TodoService.softDeleteEntity(db, parseId(id, 'todo'));
      console.log(`Todo #${id} soft-deleted`);
    });

  todo
    .command('restore <id>')
    .description('Restore a soft-deleted todo')
    .action((id: string) => {
      TodoService.restoreEntity(db, parseId(id, 'todo'));
      console.log(`Todo #${id} restored`);
    });
}
