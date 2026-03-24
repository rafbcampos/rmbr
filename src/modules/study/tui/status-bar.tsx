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
        <Box borderStyle="round" borderColor="green" paddingX={1} marginBottom={0}>
          <Text color="green" bold>
            Next: #{nextTopic.id} {nextTopic.title ?? nextTopic.raw_input}
          </Text>
        </Box>
      )}
      <Box paddingX={1}>
        <Text dimColor>
          Status: <Text bold>{statusFilter ?? 'all'}</Text> | Domain:{' '}
          <Text bold>{domainFilter ?? 'all'}</Text>
        </Text>
      </Box>
    </Box>
  );
}
