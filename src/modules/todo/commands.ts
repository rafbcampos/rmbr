import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import { TodoStatus } from '../../core/types.ts';
import { formatDuration } from '../../core/date-utils.ts';
import { TodoService } from './service.ts';
import { TimeEntryService } from './time-entry-service.ts';
import { parseTodoStatus } from './types.ts';
import { parseId } from '../../shared/validation.ts';
import { ValidationError } from '../../core/errors.ts';

function resolveActiveTodoId(db: DrizzleDatabase, idArg: string | undefined): number {
  if (idArg !== undefined) {
    return parseId(idArg, 'todo');
  }

  const count = TimeEntryService.getRunningCount(db);
  if (count === 0) {
    console.error('No active timer running. Specify a todo ID.');
    process.exit(1);
  }
  if (count > 1) {
    console.error(`Multiple timers running (${count} todos). Specify which todo ID to target.`);
    process.exit(1);
  }

  const entry = TimeEntryService.getAnyActive(db);
  if (!entry) {
    throw new ValidationError('Expected an active timer but found none');
  }
  return entry.todo_id;
}

function hasFilterFlags(opts: {
  status?: string;
  overdue?: boolean;
  dueToday?: boolean;
  dueThisWeek?: boolean;
  includeDeleted?: boolean;
}): boolean {
  return (
    opts.status !== undefined ||
    opts.overdue === true ||
    opts.dueToday === true ||
    opts.dueThisWeek === true ||
    opts.includeDeleted === true
  );
}

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
    .description('List todos (interactive TUI by default, plain text with --ai)')
    .option('--status <status>', 'Filter by status')
    .option('--overdue', 'Show overdue todos')
    .option('--due-today', 'Show todos due today')
    .option('--due-this-week', 'Show todos due this week')
    .option('--include-deleted', 'Include soft-deleted todos')
    .option('--ai', 'Plain text output for AI agents')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Page size', '20')
    .action(
      async (opts: {
        status?: string;
        overdue?: boolean;
        dueToday?: boolean;
        dueThisWeek?: boolean;
        includeDeleted?: boolean;
        ai?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const useTui = opts.ai !== true && !hasFilterFlags(opts) && process.stdout.isTTY === true;

        if (useTui) {
          const { renderTodoApp } = await import('./tui/app.tsx');
          await renderTodoApp(db);
          return;
        }

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
          const elapsed = TimeEntryService.totalElapsed(db, t.id);
          const timeStr = elapsed > 0 ? ` (${formatDuration(elapsed)})` : '';
          console.log(`  #${t.id} [${t.status}] ${t.title ?? t.raw_input}${timeStr}`);
        }
      },
    );

  todo
    .command('show <id>')
    .description('Show a todo with time tracking details')
    .action((id: string) => {
      const todoId = parseId(id, 'todo');
      const t = TodoService.getByIdWithTime(db, todoId);
      const entries = TimeEntryService.listForTodo(db, todoId);

      console.log(`Todo #${t.id} [${t.status}] ${t.title ?? t.raw_input}`);
      if (t.priority) console.log(`  Priority: ${t.priority}`);
      if (t.due_date) console.log(`  Due: ${t.due_date}`);
      if (t.goal_id) console.log(`  Goal: #${t.goal_id}`);
      const activeLabel = t.active_entry_id !== null ? ' (active)' : '';
      console.log(`  Total time: ${formatDuration(t.total_elapsed_seconds)}${activeLabel}`);

      if (entries.length > 0) {
        console.log('  Sessions:');
        for (const e of entries) {
          const stop = e.stopped_at ?? 'running';
          console.log(`    ${e.started_at} - ${stop} (${formatDuration(e.duration_seconds)})`);
        }
      }
    });

  todo
    .command('start <id>')
    .description('Start a todo (transition to in_progress)')
    .action((id: string) => {
      const todoId = parseId(id, 'todo');
      const t = TodoService.transition(db, todoId, TodoStatus.InProgress);
      const elapsed = TimeEntryService.totalElapsed(db, todoId);
      const resumeStr = elapsed > 0 ? ` (resuming, ${formatDuration(elapsed)} total)` : '';
      console.log(`Todo #${t.id} is now in_progress${resumeStr}`);
    });

  todo
    .command('pause [id]')
    .description('Pause a todo (auto-detects active timer if no id given)')
    .action((idArg: string | undefined) => {
      const todoId = resolveActiveTodoId(db, idArg);
      const t = TodoService.transition(db, todoId, TodoStatus.Paused);
      const elapsed = TimeEntryService.totalElapsed(db, todoId);
      console.log(`Todo #${t.id} is now paused (${formatDuration(elapsed)} total)`);
    });

  todo
    .command('done [id]')
    .description('Mark a todo as done (auto-detects active timer if no id given)')
    .action((idArg: string | undefined) => {
      const todoId = resolveActiveTodoId(db, idArg);
      const t = TodoService.transition(db, todoId, TodoStatus.Done);
      const elapsed = TimeEntryService.totalElapsed(db, todoId);
      console.log(`Todo #${t.id} is now done (${formatDuration(elapsed)} total)`);
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
