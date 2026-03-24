import { Box, Text } from 'ink';
import type { TimeEntry } from '../types.ts';
import { formatDuration } from '../../../core/date-utils.ts';
import type { DrizzleDatabase } from '../../../core/drizzle.ts';
import { useElapsedSeconds } from './hooks.ts';

interface StatusBarProps {
  readonly db: DrizzleDatabase;
  readonly activeEntry: TimeEntry | null;
  readonly statusFilter: string | undefined;
  readonly priorityFilter: string | undefined;
}

export function StatusBar({ db, activeEntry, statusFilter, priorityFilter }: StatusBarProps) {
  const elapsed = useElapsedSeconds(db, activeEntry ? activeEntry.todo_id : null);

  return (
    <Box flexDirection="column">
      {activeEntry !== null && (
        <Box>
          <Text color="green" bold>
            Active: #{activeEntry.todo_id}
          </Text>
          <Text color="yellow"> [{formatDuration(elapsed)}]</Text>
        </Box>
      )}
      <Box>
        <Text dimColor>
          Filter: {statusFilter ?? 'all'} | Priority: {priorityFilter ?? 'all'} |{' '}
          <Text bold>1-5</Text> status <Text bold>p</Text> priority <Text bold>Enter</Text> start{' '}
          <Text bold>Space</Text> pause <Text bold>d</Text> done <Text bold>q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}
