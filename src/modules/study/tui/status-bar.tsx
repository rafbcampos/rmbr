import { Box, Text } from 'ink';
import type { StudyTopic } from '../types.ts';

interface StatusBarProps {
  readonly nextTopic: StudyTopic | null;
  readonly statusFilter: string | undefined;
  readonly domainFilter: string | undefined;
}

export function StatusBar({ nextTopic, statusFilter, domainFilter }: StatusBarProps) {
  return (
    <Box flexDirection="column">
      {nextTopic !== null && (
        <Box>
          <Text color="green" bold>
            Next: #{nextTopic.id} {nextTopic.title ?? nextTopic.raw_input}
          </Text>
        </Box>
      )}
      <Box>
        <Text dimColor>
          Filter: {statusFilter ?? 'all'} | Domain: {domainFilter ?? 'all'} | <Text bold>1-5</Text>{' '}
          status <Text bold>d</Text> domain <Text bold>Enter</Text> start <Text bold>c</Text>{' '}
          complete <Text bold>p</Text> park <Text bold>q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}
