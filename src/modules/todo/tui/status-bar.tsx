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
        <Box borderStyle="round" borderColor="green" paddingX={1} marginBottom={0}>
          <Text color="green" bold>
            ▶ #{activeEntry.todo_id}
          </Text>
          <Text color="yellow"> ⏱ {formatDuration(elapsed)}</Text>
        </Box>
      )}
      <Box paddingX={1}>
        <Text dimColor>
          Status: <Text bold>{statusFilter ?? 'all'}</Text> | Priority:{' '}
          <Text bold>{priorityFilter ?? 'all'}</Text>
        </Text>
      </Box>
    </Box>
  );
}
