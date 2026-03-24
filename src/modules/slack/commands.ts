import type { Command } from 'commander';
import type { DrizzleDatabase } from '../../core/drizzle.ts';
import type { SlackFilters } from './service.ts';
import { SlackService } from './service.ts';
import { isSlackSentiment } from './types.ts';
import type { SlackMessage } from './types.ts';
import { parseId } from '../../shared/validation.ts';

function hasFilterFlags(opts: {
  channel?: string;
  processed?: boolean;
  sentiment?: string;
  includeDeleted?: boolean;
}): boolean {
  return (
    opts.channel !== undefined ||
    opts.processed === true ||
    opts.sentiment !== undefined ||
    opts.includeDeleted === true
  );
}

function formatSlackLine(msg: SlackMessage): string {
  const badge = msg.processed === 1 ? 'processed' : 'unprocessed';
  const channel = msg.channel !== null ? ` #${msg.channel}` : '';
  const sender = msg.sender !== null ? ` @${msg.sender}` : '';
  const content =
    msg.raw_content.length > 60 ? msg.raw_content.slice(0, 60) + '...' : msg.raw_content;
  const sentiment = msg.sentiment !== null ? ` [${msg.sentiment}]` : '';
  const todo = msg.todo_id !== null ? ` T#${msg.todo_id}` : '';
  const goal = msg.goal_id !== null ? ` G#${msg.goal_id}` : '';
  return `  #${msg.id} [${badge}]${channel}${sender}: ${content}${sentiment}${todo}${goal}`;
}

export function registerCommands(program: Command, db: DrizzleDatabase): void {
  const slack = program.command('slack').description('Manage Slack messages');

  slack
    .command('ingest')
    .description('Ingest a new Slack message')
    .argument('<content>', 'Raw message content')
    .option('--channel <channel>', 'Channel name')
    .option('--sender <sender>', 'Sender name')
    .option('--message-ts <ts>', 'Message timestamp')
    .action((content: string, opts: { channel?: string; sender?: string; messageTs?: string }) => {
      const result = SlackService.ingest(db, content, opts.channel, opts.sender, opts.messageTs);
      console.log(`Slack message ingested with id ${result.id}`);
    });

  slack
    .command('list')
    .description('List Slack messages (interactive TUI by default, plain text with --ai)')
    .option('--channel <channel>', 'Filter by channel')
    .option('--processed', 'Filter by processed status')
    .option('--sentiment <sentiment>', 'Filter by sentiment')
    .option('--include-deleted', 'Include soft-deleted messages')
    .option('--ai', 'Plain text output for AI agents')
    .option('--page <page>', 'Page number', '1')
    .option('--page-size <n>', 'Page size', '20')
    .action(
      async (opts: {
        channel?: string;
        processed?: boolean;
        sentiment?: string;
        includeDeleted?: boolean;
        ai?: boolean;
        page: string;
        pageSize: string;
      }) => {
        const useTui = opts.ai !== true && !hasFilterFlags(opts) && process.stdout.isTTY === true;

        if (useTui) {
          const { renderSlackApp } = await import('./tui/app.tsx');
          await renderSlackApp(db);
          return;
        }

        const filters: SlackFilters = {
          ...(opts.channel !== undefined ? { channel: opts.channel } : {}),
          ...(opts.processed === true ? { processed: 1 } : {}),
          ...(opts.sentiment !== undefined && isSlackSentiment(opts.sentiment)
            ? { sentiment: opts.sentiment }
            : {}),
          ...(opts.includeDeleted === true ? { includeDeleted: true } : {}),
        };
        const page = parseId(opts.page ?? '1', 'page');
        const pageSize = parseId(opts.pageSize ?? '20', 'pageSize');
        const result = SlackService.list(db, filters, { page, pageSize });
        console.log(
          `Slack messages (page ${result.page}/${result.totalPages}, total: ${result.total}):`,
        );
        for (const msg of result.data) {
          console.log(formatSlackLine(msg));
        }
      },
    );

  slack
    .command('sentiment')
    .description('Set sentiment on a Slack message')
    .argument('<id>', 'Message ID')
    .argument('<sentiment>', 'Sentiment (positive, negative, neutral)')
    .action((id: string, sentiment: string) => {
      if (!isSlackSentiment(sentiment)) {
        console.error(`Invalid sentiment: ${sentiment}. Must be positive, negative, or neutral.`);
        return;
      }
      const result = SlackService.setSentiment(db, parseId(id, 'slack message'), sentiment);
      console.log(`Slack message #${result.id} sentiment set to ${result.sentiment}`);
    });

  slack
    .command('link-todo')
    .description('Link a Slack message to a todo')
    .argument('<id>', 'Message ID')
    .argument('<todoId>', 'Todo ID')
    .action((id: string, todoId: string) => {
      const result = SlackService.linkTodo(
        db,
        parseId(id, 'slack message'),
        parseId(todoId, 'todo'),
      );
      console.log(`Slack message #${result.id} linked to todo #${result.todo_id}`);
    });

  slack
    .command('link-goal')
    .description('Link a Slack message to a goal')
    .argument('<id>', 'Message ID')
    .argument('<goalId>', 'Goal ID')
    .action((id: string, goalId: string) => {
      const result = SlackService.linkGoal(
        db,
        parseId(id, 'slack message'),
        parseId(goalId, 'goal'),
      );
      console.log(`Slack message #${result.id} linked to goal #${result.goal_id}`);
    });

  slack
    .command('process')
    .description('Mark a Slack message as processed')
    .argument('<id>', 'Message ID')
    .action((id: string) => {
      const result = SlackService.markProcessed(db, parseId(id, 'slack message'));
      console.log(`Slack message ${result.id} marked as processed`);
    });

  slack
    .command('delete')
    .description('Soft-delete a Slack message')
    .argument('<id>', 'Message ID')
    .action((id: string) => {
      SlackService.softDeleteEntity(db, parseId(id, 'slack message'));
      console.log(`Slack message #${id} soft-deleted`);
    });

  slack
    .command('restore')
    .description('Restore a soft-deleted Slack message')
    .argument('<id>', 'Message ID')
    .action((id: string) => {
      SlackService.restoreEntity(db, parseId(id, 'slack message'));
      console.log(`Slack message #${id} restored`);
    });
}
